/* Guided default and explicit classic A: existing local Playwright/Chromium only. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = process.env.SITE_URL || 'http://127.0.0.1:8000';
const output = process.env.ARTIFACT_DIR || path.join(root, 'artifacts/guided-experience');
const baseline = process.env.BASELINE_DIR;
let fixture;
function useLanguage(locale) {
  const directory = path.join(root, 'assets/examples', locale === 'fr' ? 'fr' : '');
  fixture = JSON.parse(fs.readFileSync(path.join(directory, 'results.json')));
  raw = JSON.parse(fs.readFileSync(path.join(directory, 'raw-outputs.json')));
}
let raw;
fs.mkdirSync(path.join(output, 'screenshots'), { recursive: true });
const report = { checks: [], errors: [], requests: [], screenshots: [], videos: [], baselinePixels: [], widths: [], motion: [] };
async function check(name, fn) { await fn(); report.checks.push({ name, result: 'PASS' }); console.log('PASS', name); }
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#modify-state').textContent === 'VALID');
  await page.evaluate(() => document.fonts.ready);
}
async function inspectSelection(page, field) {
  const pointer = field === 'request' ? '/prompt' : '/output';
  const range = fixture.inspector.byte_ranges[pointer];
  assert.equal(await page.locator('[data-field][aria-pressed=true]').count(), 1);
  assert.equal(await page.locator(`[data-field=${field}]`).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#guided-primary-hash .hash-label').textContent(), field + '_hash');
  assert.equal(await page.locator('#guided-primary-hash .full-hash').textContent(), fixture.records['record-a'].payload.metadata[field + '_hash']);
  assert.equal(await page.locator('#guided-primary-hash .byte').count(), 0);
  const excerpt = await page.locator('#guided-byte-excerpt').textContent();
  const hex = excerpt.split('\n').map(line => line.slice(6).replaceAll(' ', '')).join('');
  assert.equal(hex, Buffer.from(fixture.inspector.canonical_utf8).subarray(range.start, Math.min(range.start + 32, range.end)).toString('hex'));
  assert.equal(await page.locator('#guided-byte-excerpt').getAttribute('data-start'), String(range.start));
  assert.equal(await page.locator('#byte-grid .byte.selected').count(), range.end - range.start);
  assert.equal((await page.locator('#byte-grid .byte.selected').allTextContents()).join(''), Buffer.from(fixture.inspector.canonical_utf8).subarray(range.start, range.end).toString('hex'));
  assert.equal(await page.locator('#derived-hashes .selected-derived').getAttribute('data-derived-hash'), field + '_hash');
}
async function inspectModify(page, name) {
  const record = fixture.records[name];
  assert.equal(await page.locator('#modified-response').textContent(), record.payload.output);
  assert.equal(await page.locator('#recomputed-hash .full-hash').textContent(), record.recomputed_payload_hash);
  assert.equal(await page.locator('#expected-hash .full-hash').textContent(), fixture.records['record-a'].manifest.ai_hash_sha256);
  assert.equal(await page.locator('#modify-state').textContent(), raw['api-verify-' + name].result.payload_integrity);
  assert.equal(await page.locator('#modify-state').getAttribute('data-state'), record.verification.payload_integrity);
  assert.match(await page.locator('#modify-reason').textContent(), new RegExp(record.verification.reason));
  assert.equal(await page.locator('#modify-state').evaluate(e => getComputedStyle(e).color), name === 'record-a' ? 'rgb(17, 17, 17)' : 'rgb(165, 42, 42)');
}
async function capture(page, locale, width, experience, section, state = 'initial') {
  const name = `${locale}-${width}-${experience}-${section}-${state}.png`;
  await page.locator('#' + section).screenshot({ path: path.join(output, 'screenshots', name), animations: 'disabled' });
  report.screenshots.push(name);
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  report.browser = browser.version();
  try {
    for (const locale of ['en', 'fr']) {
      useLanguage(locale);
      const route = locale === 'en' ? '/' : '/fr/';
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce', hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      page.on('request', r => report.requests.push({ url: r.url(), method: r.method() }));
      await check(`${locale}: guided default on desktop/mobile; language navigation preserves default and classic`, async () => {
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height:1000 });
          await page.goto(origin + route + '#inspector'); await ready(page);
          assert.equal(await page.locator('html').getAttribute('data-experience'), 'guided');
          assert.equal(await page.locator('#modify-choice').isVisible(), false);
          assert.equal(await page.locator('#change-to-four').isVisible(), true);
          await inspectSelection(page, 'request');
          await page.locator('#change-to-four').press('Enter'); await inspectModify(page, 'record-a-modified');
          await page.locator('#reset-example').press('Space'); await inspectModify(page, 'record-a');
          const other = locale === 'en' ? 'fr' : 'en';
          await page.locator(`.languages a[lang=${other}]`).last().press('Enter'); await ready(page);
          assert.equal(await page.locator('html').getAttribute('lang'), other);
          assert.equal(await page.locator('html').getAttribute('data-experience'), 'guided');
          assert.equal(new URL(page.url()).search, '');
          await page.goBack(); await ready(page);
          assert.equal(await page.locator('html').getAttribute('lang'), locale);
          assert.equal(await page.locator('html').getAttribute('data-experience'), 'guided');
          await page.goto(origin + route + '?experience=classic'); await ready(page);
          assert.equal(await page.locator('#modify-choice').isVisible(), true);
          await page.locator(`.languages a[lang=${other}]`).last().press('Enter'); await ready(page);
          assert.equal(new URL(page.url()).searchParams.get('experience'), 'classic');
          assert.equal(await page.locator('html').getAttribute('lang'), other);
          assert.equal(await page.locator('html').getAttribute('data-experience'), null);
          assert.equal(await page.locator('#modify-choice').isVisible(), true);
        }
      });
      await check(`${locale}: explicit A and baseline pixel comparison; comparable A/B captures`, async () => {
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(origin + route + '?experience=classic'); await ready(page);
          assert.equal(await page.locator('html').getAttribute('data-experience'), null);
          assert.equal(await page.locator('#modify-choice').isVisible(), true);
          for (const section of ['product', 'records']) {
            await capture(page, locale, width, 'A', section);
            if (baseline) {
              const prior = await context.newPage();
              await prior.setViewportSize({ width, height:1000 });
              await prior.route('**/assets/site.*', r => r.fulfill({ path: path.join(baseline, new URL(r.request().url()).pathname) }));
              // Compare the same localized content with the original A rendering.
              await prior.route('**/assets/examples/results.json', r => r.fulfill({json:fixture}));
              await prior.goto(origin + route); await ready(prior);
              assert.equal(await prior.locator('html').getAttribute('data-experience'), null, 'Baseline must render A');
              const before = await prior.locator('#' + section).screenshot({ animations: 'disabled' });
              const after = fs.readFileSync(path.join(output, 'screenshots', `${locale}-${width}-A-${section}-initial.png`));
              if (!after.equals(before)) fs.writeFileSync(path.join(output, 'screenshots', `${locale}-${width}-baseline-${section}.png`), before);
              assert.ok(after.equals(before), `A differs from baseline: ${locale}/${width}/${section}`);
              report.baselinePixels.push({ locale, width, section, identical: true });
              await prior.close();
            }
          }
          await page.selectOption('#modify-choice', 'record-a-modified');
          await capture(page, locale, width, 'A', 'records', 'modified');
          await page.goto(origin + route + '?experience=guided'); await ready(page);
          await inspectSelection(page, 'request');
          for (const section of ['product', 'records']) await capture(page, locale, width, 'B', section);
          await page.locator('#change-to-four').click();
          await capture(page, locale, width, 'B', 'records', 'modified');
        }
      });
      await check(`${locale}: B initial hierarchy, keyboard/touch, full evidence, copy and no forced scrolling`, async () => {
        await page.setViewportSize({ width: 390, height: 1000 });
        await page.goto(origin + route + '?experience=guided'); await ready(page);
        assert.equal(await page.locator('[data-field]').count(), 2);
        assert.equal(await page.locator('.guided-inspector-details').getAttribute('open'), null);
        assert.equal(await page.locator('#guided-primary-hash .full-hash').isVisible(), true);
        for (const field of ['response', 'request']) {
          const control = page.locator(`[data-field=${field}]`);
          await control.scrollIntoViewIfNeeded();
          await control.focus();
          assert.equal(await control.evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
          const scroll = await page.evaluate(() => [scrollY, document.querySelector('#byte-grid').scrollTop]);
          await page.keyboard.press('Enter');
          await inspectSelection(page, field);
          assert.deepEqual(await page.evaluate(() => [scrollY, document.querySelector('#byte-grid').scrollTop]), scroll);
          assert.equal(await control.evaluate(e => e === document.activeElement), true);
          assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
        }
        await page.locator('[data-field=response]').tap(); await inspectSelection(page, 'response');
        await page.locator('#guided-primary-hash .hash-copy').click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), fixture.records['record-a'].payload.metadata.response_hash);
        await page.locator('.guided-inspector-details > summary').press('Space');
        await page.locator('#canonical-step > summary').press('Enter');
        await page.locator('#derived-step > summary').press('Enter');
        assert.equal(await page.locator('#byte-grid .byte').count(), Buffer.byteLength(fixture.inspector.canonical_utf8));
        assert.equal(await page.locator('#derived-hashes .hash-block').count(), 4);
        for (const details of await page.locator('#derived-hashes .hash-block details').all()) {
          await details.locator('summary').press('Enter');
          assert.equal(await details.locator('.full-hash').isVisible(), true);
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        assert.equal(await page.locator('.guided-inspector-details').getAttribute('open'), '');
        assert.equal(await page.locator('#canonical-step').getAttribute('open'), '');
        assert.equal(await page.locator('#derived-step').getAttribute('open'), '');
      });
      await check(`${locale}: direct Modify/reset uses only prepared pair and retains expected hash node`, async () => {
        const expected = await page.locator('#expected-hash .full-hash').elementHandle();
        await page.locator('#change-to-four').press('Enter'); await inspectModify(page, 'record-a-modified');
        await page.locator('.guided-modify-reference > summary').press('Enter');
        assert.equal(await expected.evaluate(e => e === document.querySelector('#expected-hash .full-hash')), true);
        assert.equal(await page.locator('#expected-hash .full-hash').isVisible(), true);
        await page.locator('#reset-example').press('Space'); await inspectModify(page, 'record-a');
        assert.equal(await page.locator('#reset-example').evaluate(e => e === document.activeElement), true);
        assert.equal(await page.locator('#modify-choice').isVisible(), false);
        assert.equal(await page.locator('[contenteditable],textarea,input').count(), 0);
        assert.match(await page.locator('.guided-modify .example-note').textContent(), /v0\.4\.0/);
      });
      await check(`${locale}: rapid actions, short visitor-triggered motion and reduced motion changes`, async () => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto(origin + route + '?experience=guided'); await ready(page);
        assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'no load animation');
        const timings = await page.evaluate(() => {
          document.querySelector('[data-field=response]').click();
          return document.getAnimations().map(a => ({ duration: a.effect.getTiming().duration, delay: a.effect.getTiming().delay }));
        });
        assert.deepEqual(timings.map(t => t.delay).sort((a,b) => a-b), [0,80,160]);
        assert.ok(timings.every(t => t.duration === 160)); report.motion.push({ locale, timings });
        await page.evaluate(() => {
          for (let i=0;i<30;i++) {
            document.querySelector(`[data-field=${i % 2 ? 'request' : 'response'}]`).click();
            document.querySelector(i % 2 ? '#reset-example' : '#change-to-four').click();
          }
          document.querySelector('[data-field=response]').click();
          document.querySelector('#change-to-four').click();
        });
        await inspectSelection(page, 'response'); await inspectModify(page, 'record-a-modified');
        await page.waitForFunction(() => document.getAnimations().length === 0);
        await inspectSelection(page, 'response'); await inspectModify(page, 'record-a-modified');
        await page.evaluate(() => document.querySelector('[data-field=request]').click());
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => document.getAnimations().length === 0);
        await page.locator('#reset-example').click();
        await inspectModify(page, 'record-a'); await inspectSelection(page, 'request');
        assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      });
      await check(`${locale}: 320/390/768/1024/1440 layout, touch targets, 200% text`, async () => {
        for (const scale of [100, 200]) for (const width of (scale === 100 ? [320,390,768,1024,1440] : [320,390,1440])) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(origin + route + '?experience=guided'); await ready(page);
          if (scale === 200) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          await page.locator('#change-to-four').click(); await inspectModify(page, 'record-a-modified');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
          for (const selector of ['[data-field=request]','[data-field=response]','#change-to-four','#reset-example','.guided-inspector-details > summary','.guided-modify-reference > summary','#guided-primary-hash .hash-copy']) {
            const box = await page.locator(selector).boundingBox(); assert.ok(box.height >= 44 && box.width >= 44, selector);
          }
          for (const selector of ['.guided-fields .record-field','#guided-byte-excerpt','#guided-primary-hash .full-hash','#modified-response','#recomputed-hash .full-hash']) {
            const dimensions = await page.locator(selector).evaluateAll(elements => elements.map(e => ({font:parseFloat(getComputedStyle(e).fontSize),width:e.clientWidth,scroll:e.scrollWidth,height:e.clientHeight,fullHeight:e.scrollHeight})));
            assert.ok(dimensions.length > 0, selector);
            for (const d of dimensions) assert.ok(d.font >= 14 && d.scroll <= d.width + 1 && d.fullHeight <= d.height + 1, selector + JSON.stringify(d));
          }
          const spacing = await page.evaluate(() => {
            const box = selector => document.querySelector(selector).getBoundingClientRect();
            const actions = box('.guided-modify-actions'), button = box('#change-to-four');
            const response = box('#modified-response'), result = box('.guided-modify .result-panel');
            const label = box('.guided-modify .result-panel .eyebrow'), state = box('#modify-state');
            const gap = state.top - button.bottom;
            return { gap, responseGap: response.top - actions.bottom, resultGap: result.top - response.bottom,
              // At 200%, the reset control, response and label legitimately wrap.
              // Measure unexplained spacing separately from their rendered height.
              spacingOnly: gap - (actions.bottom - button.bottom) - response.height - label.height,
              rem: parseFloat(getComputedStyle(document.documentElement).fontSize) };
          });
          if (scale === 100) assert.ok(spacing.gap < 220, `control/result gap ${spacing.gap}`);
          else {
            assert.ok(spacing.responseGap >= 0 && spacing.responseGap <= spacing.rem, JSON.stringify(spacing));
            assert.ok(spacing.resultGap >= 0 && spacing.resultGap <= spacing.rem, JSON.stringify(spacing));
            assert.ok(spacing.spacingOnly >= 0 && spacing.spacingOnly <= 4 * spacing.rem, JSON.stringify(spacing));
          }
          report.widths.push({ locale, width, textPercent:scale, controlResultGap:spacing.gap, spacingOnly:spacing.spacingOnly, overflow:false });
          if (width === 320 && scale === 100) for (const section of ['product','records']) await capture(page,locale,width,'B',section,'regression');
        }
      });
      await check(`${locale}: email preserved, menu and EN/FR navigation retain B; unknown query stays A`, async () => {
        await page.goto(origin + route + '?experience=guided'); await ready(page);
        assert.deepEqual(await page.locator('[data-email]').evaluateAll(links => links.map(a => a.getAttribute('href'))), [
          'mailto:hello@aelitium.com?subject=%5BAELITIUM%20Feedback%5D',
          'mailto:hello@aelitium.com?subject=%5BAELITIUM%20Contact%5D',
          'mailto:hello@aelitium.com?subject=%5BAELITIUM%20Contact%5D']);
        await page.locator('[data-copy-target=contact-email]').click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'hello@aelitium.com');
        await page.setViewportSize({ width:390, height:1000 });
        await page.locator('#menu-toggle').press('Enter');
        await page.locator(`.languages a[lang=${locale === 'en' ? 'fr' : 'en'}]`).first().press('Enter');
        await ready(page); assert.equal(new URL(page.url()).searchParams.get('experience'), 'guided');
        assert.equal(await page.locator('html').getAttribute('lang'), locale === 'en' ? 'fr' : 'en');
        await page.goto(origin + route + '?experience=unknown'); await ready(page);
        assert.equal(await page.locator('html').getAttribute('data-experience'), null);
      });
      await context.close();

      await check(`${locale}: B fails closed with 404, partial HTTP 200 and late rendering failure`, async () => {
        for (const fault of ['404','partial','late']) {
          const failureContext = await browser.newContext({ viewport: { width:390,height:1000 } });
          const p = await failureContext.newPage();
          if (fault === 'late') await p.addInitScript(() => {
            const replace = Element.prototype.replaceChildren; let failed = false;
            Element.prototype.replaceChildren = function(...args) {
              if (!failed && this.matches('[data-comparison="changed"] .compare-hashes')) { failed = true; throw Error('Test-only late failure'); }
              return replace.apply(this,args);
            };
          });
          else await p.route('**/assets/examples/**/results.json', r => {
            const data = structuredClone(fixture); delete data.comparisons.changed;
            return r.fulfill({ status:fault === '404' ? 404 : 200, contentType:'application/json', body:JSON.stringify(data) });
          });
          await p.goto(origin + route + '?experience=guided');
          await p.waitForFunction(() => /inactive|inactifs/.test(document.querySelector('#inspector .connection-status').textContent));
          for (const control of ['[data-field=request]','[data-field=response]','#change-to-four','#reset-example']) assert.equal(await p.locator(control).isDisabled(), true);
          assert.equal(await p.locator('#modify-state').getAttribute('data-state'), 'UNAVAILABLE');
          assert.equal(await p.locator('#guided-primary-hash .full-hash,#byte-grid .byte').count(), 0);
          assert.equal(await p.locator('#guided-byte-excerpt').textContent(), '—');
          assert.equal(await p.locator('.guided-evidence').getAttribute('data-available'), null);
          assert.equal(await p.locator('#modified-response').textContent(), '—');
          assert.equal(await p.locator('#expected-hash').textContent(), '—');
          assert.equal(await p.locator('#recomputed-hash').textContent(), '—');
          assert.equal(await p.evaluate(() => document.getAnimations().length), 0);
          assert.equal(await p.locator('[data-email=feedback]').getAttribute('href'), 'mailto:hello@aelitium.com?subject=%5BAELITIUM%20Feedback%5D');
          if (fault === 'partial') await p.locator('#inspector').screenshot({ path:path.join(output,'screenshots',`${locale}-390-B-unavailable.png`) });
          await failureContext.close();
        }
      });
      await check(`${locale}: no JavaScript keeps honest static A fallback and direct email`, async () => {
        const c = await browser.newContext({ javaScriptEnabled:false, viewport:{width:320,height:1000} });
        const p = await c.newPage(); await p.goto(origin + route + '?experience=guided');
        assert.equal(await p.locator('#modify-choice').isDisabled(), true);
        assert.equal(await p.locator('#modify-state').getAttribute('data-state'), 'UNAVAILABLE');
        assert.equal(await p.locator('[data-email]').count(), 3);
        assert.equal(await p.locator('#contact-email').textContent(), 'hello@aelitium.com');
        await c.close();
      });
    }
    await check('Same-origin GET requests only, no browser errors', async () => {
      assert.deepEqual(report.errors, []);
      for (const r of report.requests) { assert.equal(r.method,'GET'); assert.equal(new URL(r.url).origin,origin); }
    });
    // Real browser recordings, using the already installed Playwright ffmpeg.
    for (const locale of ['en','fr']) {
      const c = await browser.newContext({viewport:{width:390,height:900}, recordVideo:{dir:path.join(output,'video-tmp'),size:{width:390,height:900}},reducedMotion:'no-preference'});
      const p = await c.newPage(); const video = p.video();
      await p.goto(origin + (locale === 'en' ? '/' : '/fr/') + '?experience=guided'); await ready(p);
      await p.locator('#inspector').scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
      await p.locator('[data-field=response]').click(); await p.waitForTimeout(1000);
      await p.locator('[data-field=request]').click(); await p.waitForTimeout(1000);
      await p.locator('.guided-modify').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
      await p.locator('#change-to-four').click(); await p.waitForTimeout(1200);
      await p.locator('#reset-example').click(); await p.waitForTimeout(1000);
      await c.close();
      const name = `${locale}-guided-selection-modify-reset.webm`;
      await video.saveAs(path.join(output,name)); await video.delete(); report.videos.push(name);
    }
  } finally {
    report.baselineComparison = baseline ? 'Executed against preserved local assets' : 'NOT_RUN: BASELINE_DIR not supplied';
    fs.writeFileSync(path.join(output,'guided-results.json'), JSON.stringify(report,null,2)+'\n');
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
