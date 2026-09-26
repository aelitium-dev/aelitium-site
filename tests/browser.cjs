/* PLAYWRIGHT_MODULE may point to an existing local installation. No installer. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = process.env.SITE_URL || 'http://127.0.0.1:8000';
const output = process.env.ARTIFACT_DIR ? path.resolve(process.env.ARTIFACT_DIR) : path.join(root, 'artifacts/email-contact/chromium');
fs.mkdirSync(path.join(output, 'screenshots'), { recursive: true });
let raw;
let fixtures;
function useLanguage(locale) {
  const directory = path.join(root, 'assets/examples', locale === 'fr' ? 'fr' : '');
  fixtures = JSON.parse(fs.readFileSync(path.join(directory, 'results.json')));
  raw = JSON.parse(fs.readFileSync(path.join(directory, 'raw-outputs.json')));
}
const report = { browser: '', checks: [], widths: [], textZoom: [], mobileCompare: [], fixtureFailures: [], visualStates: [], compareHeights: [], screenshots: [], requests: [], feedbackRequests: [], errors: [] };
async function check(name, fn) {
  await fn();
  report.checks.push({ name, result: 'PASS' });
  console.log('PASS', name);
}
const stateStyle = {
  VALID: ['rgb(17, 17, 17)','●'], INVALID: ['rgb(165, 42, 42)','×'],
  INVALID_BUNDLE: ['rgb(165, 42, 42)','×'], ABSENT: ['rgb(98, 98, 94)','○'],
  UNESTABLISHED: ['rgb(98, 98, 94)','◇'], NOT_EVALUATED: ['rgb(98, 98, 94)','–'],
  NOT_COMPARABLE: ['rgb(36, 71, 255)','≠'], UNAVAILABLE: ['rgb(98, 98, 94)','…'],
};
async function assertState(locator,state,source) {
  assert.equal(await locator.getAttribute('data-state'),state);
  if(state!=='UNAVAILABLE') assert.equal(await locator.textContent(),state);
  const actual=await locator.evaluate(e=>[getComputedStyle(e).color,getComputedStyle(e,'::before').content.replace(/^"|"$/g,'')]);
  assert.deepEqual(actual,stateStyle[state],source+': '+state);
  report.visualStates.push({source,state,color:actual[0],marker:actual[1]});
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  report.platform = process.platform;
  report.executable = process.env.BROWSER_EXECUTABLE || chromium.executablePath();
  report.browser = browser.version();
  try {
    for (const locale of ['en', 'fr']) {
      useLanguage(locale);
      const route = locale === 'en' ? '/' : '/fr/';
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'], hasTouch: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', e => report.errors.push(e.message));
      page.on('request', req => report.requests.push({ url: req.url(), method: req.method(), hasBody: !!req.postData() }));
      async function go(width = 1440) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(origin + route + '?experience=classic');
        await page.waitForFunction(() => document.querySelector('#modify-state').textContent === 'VALID');
        await page.evaluate(() => document.fonts.ready);
      }
      await check(`${locale}: responsive widths`, async () => {
        for (const width of [320, 390, 768, 1024, 1440]) {
          await go(width);
          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          assert.equal(scrollWidth, width, `${locale} overflow at ${width}`);
          report.widths.push({ locale, width, scrollWidth });

        }
      });
      await check(`${locale}: Modify and eight assurance properties match release outputs`, async () => {
        await page.selectOption('#modify-choice', 'record-a-modified');
        assert.equal(await page.locator('#modify-state').textContent(), raw['api-verify-record-a-modified'].result.payload_integrity);
        assert.match(await page.locator('#modify-reason').textContent(), /HASH_MISMATCH/);
        const fixedHash = await page.locator('#expected-hash .full-hash').textContent();
        assert.equal(fixedHash, fixtures.records['record-a'].manifest.ai_hash_sha256);
        await page.locator('#reset-example').click();
        assert.equal(await page.locator('#modify-state').textContent(), 'VALID');
        if (await page.locator('#toggle-properties').getAttribute('aria-expanded') === 'false') await page.locator('#toggle-properties').click();
        assert.equal(await page.locator('#toggle-properties').getAttribute('aria-expanded'), 'true');
        for (const [key,value] of Object.entries(raw['api-verify-record-a'].result)) {
          if (['valid','reason'].includes(key)) continue;
          assert.equal(await page.locator(`[data-property="${key}"]`).textContent(), value);
          assert.equal(await page.locator(`[data-property="${key}"]`).isVisible(), true);
        }
        const row = page.locator('.assurance-row summary').first();
        await row.focus(); await page.keyboard.press('Enter');
        assert.equal(await page.locator('.assurance-row').first().getAttribute('open'), '');
        await page.locator('#toggle-properties').click();
        assert.equal(await page.locator('#extra-properties').isVisible(), false);
      });
      await check(`${locale}: four Compare scenarios match raw CLI output`, async () => {
        for (const key of ['changed', 'not-comparable', 'unchanged', 'invalid']) {
          let selector = `[data-comparison="${key}"]`;
          if (['unchanged','invalid'].includes(key)) {
            if (await page.locator('.other-scenarios').getAttribute('open') === null) {
              await page.locator('.other-scenarios > summary').click();
            }
            await page.selectOption('#compare-choice', key);
            selector = '[data-comparison="extra"]';
          }
          const expected = JSON.parse(raw['compare-' + key].stdout);
          assert.equal(await page.locator(`${selector} .verdict`).textContent(), expected.status);
          const details = page.locator(`${selector} .comparison-details`);
          assert.equal(await details.getAttribute('open'), null);
          assert.equal(await page.locator(`${selector} .verdict`).isVisible(), true);
          assert.equal(await details.locator('dd').first().isVisible(), false);
          await details.locator(':scope > summary').focus();
          await page.keyboard.press('Enter');
          const values = await details.locator('dd').allTextContents();
          for (const datum of await details.locator('dd,.full-hash').all()) assert.equal(await datum.isVisible(), true);
          if (expected.detail) assert.equal(values[4], expected.detail);
          assert.deepEqual(values.slice(0,4), [expected.comparison_mode, expected.comparison_basis, expected.comparison_reason, String(expected.rc)]);
          const full = await page.locator(`${selector} .full-hash`).allTextContents();
          const expectedHashes = ['invocation_identity_hash','response_hash'].flatMap(field => ['a','b'].map(side => expected[`${field}_${side}`])).filter(Boolean);
          assert.deepEqual(full, expectedHashes);
          for (const button of await details.locator('.hash-copy').all()) {
            const target = await button.getAttribute('data-copy-target');
            await button.click();
            assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.locator('#'+target).textContent());
          }
          await details.locator(':scope > summary').press('Space');
          assert.equal(await details.getAttribute('open'), null);
        }
      });
      await check(`${locale}: field, canonical bytes and whole derived hash selection`, async () => {
        for (const [field,pointer] of [['request','/prompt'],['response','/output']]) {
          await page.locator(`[data-field=${field}]`).focus();
          await page.keyboard.press('Enter');
          assert.equal(await page.locator(`[data-field=${field}]`).getAttribute('aria-pressed'), 'true');
          const span = fixtures.inspector.byte_ranges[pointer];
          assert.equal(await page.locator('.byte.selected').count(), span.end - span.start);
          const selected = (await page.locator('.byte.selected').allTextContents()).join('');
          const expected = Buffer.from(fixtures.inspector.canonical_utf8).subarray(span.start, span.end).toString('hex');
          assert.equal(selected, expected);
          assert.equal(await page.locator('.selected-derived').count(), 1);
          assert.equal(await page.locator('.selected-derived').getAttribute('data-derived-hash'), field+'_hash');
          assert.equal(await page.locator('.selected-derived .full-hash').textContent(), fixtures.records['record-a'].payload.metadata[field+'_hash']);
          assert.equal(await page.locator('.selected-derived .derived-selection').isVisible(), true);
          assert.equal(await page.locator('#derived-hashes .byte').count(),0,'no digest-byte mapping');
        }
        await page.locator('[data-field=parameters]').click();
        assert.equal(await page.locator('.byte.selected').count(), 0);
        assert.equal(await page.locator('.selected-derived').count(),0);
      });
      await check(`${locale}: real clipboard command/full hash and denied fallback`, async () => {
        await page.locator('[data-copy-target=release-install]').click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'pip install aelitium');
        assert.match(await page.locator('#release .copy-status').textContent(), /Copied|Copié/);
        await page.locator('#derived-hashes .hash-copy').first().click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), fixtures.records['record-a'].manifest.ai_hash_sha256);
        await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('Permission denied in test'); } } }); });
        await page.locator('[data-copy-target=release-install]').click();
        assert.match(await page.locator('#release .copy-status').textContent(), /unavailable|indisponible/);
        assert.equal(await page.evaluate(() => getSelection().toString()), 'pip install aelitium');
        await page.locator('#derived-hashes .hash-copy').first().click();
        assert.equal(await page.evaluate(() => getSelection().toString()), fixtures.records['record-a'].manifest.ai_hash_sha256);
      });
      await check(`${locale}: mobile keyboard menu, skip link, accordions and focus`, async () => {
        await go(390);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('.skip-link').evaluate(e => e === document.activeElement), true);
        assert.equal(await page.locator('.skip-link').evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
        await page.locator('#menu-toggle').focus(); await page.keyboard.press('Enter');
        assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.closest('nav')?.id), 'site-nav');
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-toggle');
        assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
        await page.keyboard.press('Enter');
        await page.locator('#site-nav a[href="#records"]').click();
        assert.equal(await page.evaluate(() => document.activeElement.id), 'records');
        assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('#canonical-step').getAttribute('open'), null);
        await page.locator('#canonical-step > summary').focus(); await page.keyboard.press('Space');
        assert.equal(await page.locator('#canonical-step').getAttribute('open'), '');
        for (const disclosure of await page.locator('.boundaries > details').all()) {
          await disclosure.locator('summary').focus(); await page.keyboard.press('Enter');
          assert.equal(await disclosure.getAttribute('open'), '');
        }
        assert.equal(await page.locator('.closing').isVisible(), true);
        await page.locator('.boundaries > details > summary').first().press('Enter');
        assert.equal(await page.locator('.boundaries > details').first().getAttribute('open'), null);
      });
      await check(`${locale}: email links, keyboard, selectable address and copy without submission`, async () => {
        for(const width of [320,390,1440]) {
          await go(width);
          assert.equal(await page.locator('#feedback-flow,form,fieldset,textarea,input').count(),0);
          assert.equal(await page.locator('#contact-email').textContent(),'hello@aelitium.com');
          assert.equal(await page.locator('#contact-email').evaluate(e=>getComputedStyle(e).userSelect),'all');
          assert.match(await page.locator('#email-client-note').textContent(),/open your email app|ouvrent votre application de messagerie/);
          assert.equal(await page.locator('#feedback a[href="https://github.com/aelitium-dev/aelitium-v3/issues"]').count(),1);
          // Intercept only in the test: verify native link activation without launching
          // the visitor's external mail handler or preparing/sending any real email.
          await page.evaluate(()=>{
            window.emailActivations=[];
            document.addEventListener('click',event=>{
              const anchor=event.target.closest('a[href^="mailto:"]');
              if(anchor){window.emailActivations.push(anchor.href);event.preventDefault();}
            });
          });
          const requestsBefore=report.requests.length;
          const links=page.locator('a[data-email]');
          assert.equal(await links.count(),3);
          for(const link of await links.all()) {
            const kind=await link.getAttribute('data-email');
            const href=await link.getAttribute('href');
            const url=new URL(href);
            assert.equal(url.protocol,'mailto:');assert.equal(url.pathname,'hello@aelitium.com');
            assert.deepEqual([...url.searchParams],[['subject',kind==='feedback'?'[AELITIUM Feedback]':'[AELITIUM Contact]']]);
            await link.focus();
            assert.equal(await link.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
            assert((await link.boundingBox()).height>=44);
            await page.keyboard.press('Enter');
            assert.equal(await page.evaluate(()=>window.emailActivations.at(-1)),href);
          }
          assert.equal(await page.locator('#feedback .copy-status').textContent(),'');
          const copy=page.locator('[data-copy-target=contact-email]');
          await copy.focus();await page.keyboard.press('Enter');
          assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'hello@aelitium.com');
          assert.match(await page.locator('#feedback .copy-status').textContent(),/Copied|Copié/);
          const box=await copy.boundingBox();assert(box.width>=44&&box.height>=44);
          assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length,document.cookie]),[0,0,'']);
          assert.equal(report.requests.length,requestsBefore,'email controls must make no application request');
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
          report.feedbackRequests.push({locale,width,requests:[],mailtoActivations:3,copy:'PASS'});
          if(width!==320)await page.locator('#feedback').screenshot({path:path.join(output,'screenshots',`${locale}-${width}-email-contact.png`)});
          await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Copy denied in test');}}});});
          await copy.click();
          assert.equal(await page.evaluate(()=>getSelection().toString()),'hello@aelitium.com');
          assert.match(await page.locator('#feedback .copy-status').textContent(),/unavailable|indisponible/);
        }
      });
      await check(`${locale}: Compare mobile hierarchy, readable data and touch targets`, async () => {
        for (const width of [320,390]) {
          await go(width);
          for (const key of ['changed','not-comparable']) {
            const card = page.locator(`[data-comparison="${key}"]`);
            assert.deepEqual(await card.locator('[data-relationship]').evaluateAll(nodes => nodes.map(n=>n.dataset.relationship)),['identity','response']);
            const identity = await card.locator('[data-relationship=identity]').boundingBox();
            const response = await card.locator('[data-relationship=response]').boundingBox();
            const outcome = await card.locator('.compare-result').boundingBox();
            assert(identity.y + identity.height <= response.y + 1);
            assert(response.y + response.height <= outcome.y + 1);
            const details = card.locator('.comparison-details');
            assert.equal(await details.getAttribute('open'),null);
            assert.equal(await card.locator('.verdict').isVisible(),true);
            assert.equal(await card.locator('.full-hash').first().isVisible(),false);
            const disclosure = await details.boundingBox();
            assert(outcome.y + outcome.height <= disclosure.y + 1);
            const summary = details.locator(':scope > summary');
            assert((await summary.boundingBox()).height>=44);
            await summary.tap();
            for (const pair of await card.locator('.compare-pair').all()) {
              const a=await pair.locator(':scope > div').nth(0).boundingBox();
              const b=await pair.locator(':scope > div').nth(1).boundingBox();
              assert(b.y >= a.y + a.height, 'mobile A/B values must stack');
            }
            const typography = await card.locator('h4,.hash-label,.full-hash,.run-label,.comparison-metadata dt,.comparison-metadata dd,.comparison-details > summary').evaluateAll(nodes=>nodes.map(n=>({className:n.className||n.tagName,size:parseFloat(getComputedStyle(n).fontSize)})));
            assert(typography.every(item=>item.size>=14),JSON.stringify(typography));
            for (const button of await card.locator('.hash-copy').all()) {
              const box=await button.boundingBox(); assert(box.width>=44 && box.height>=44);
            }
            if(key==='not-comparable') {
              assert.match(await card.locator('[data-hash-dimension=identity] .comparison-note').textContent(),/record-c/);
              assert.match(await card.locator('[data-relationship=response]').textContent(),/No response-change conclusion|Aucune conclusion/);
              assert.match(await card.locator('[data-hash-dimension=response] .comparison-note').textContent(),/prevent a response-change conclusion|empêchent toute conclusion/);
            }
            await summary.tap();
            assert.equal(await details.getAttribute('open'),null);
            report.mobileCompare.push({locale,width,scenario:key,minEssentialFontPx:Math.min(...typography.map(x=>x.size)),stacked:true,initialOutcomeVisible:true,detailsAfterOutcome:true});
          }
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
        }
      });
      await check(`${locale}: loaded visual states, neutral unavailable markers and restrained invalid color`, async () => {
        await go();
        await assertState(page.locator('#modify-state'),'VALID',locale);
        await page.selectOption('#modify-choice','record-a-modified');
        await assertState(page.locator('#modify-state'),'INVALID',locale);
        await page.locator('#reset-example').click();
        await assertState(page.locator('#modify-state'),'VALID',locale);
        for(const [key,value] of Object.entries(raw['api-verify-record-a'].result)) {
          if(['valid','reason'].includes(key)) continue;
          await assertState(page.locator(`[data-property="${key}"]`),value,locale);
        }
        await assertState(page.locator('[data-comparison="not-comparable"] .verdict'),'NOT_COMPARABLE',locale);
        await page.locator('.other-scenarios > summary').click();
        await page.selectOption('#compare-choice','invalid');
        await assertState(page.locator('[data-comparison="extra"] .verdict'),'INVALID_BUNDLE',locale);
        // Presentation-only response override: use the retained verification output
        // for the modified record to exercise Assurance's loaded INVALID mapping.
        // No fixture on disk is changed and no screenshot uses this override.
        const data=structuredClone(fixtures);
        data.records['record-a'].verification=raw['api-verify-record-a-modified'].result;
        await page.route('**/assets/examples/**/results.json', route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
        await page.reload();
        await page.waitForFunction(()=>document.querySelector('[data-property=payload_integrity]').textContent==='INVALID');
        for(const [key,value] of Object.entries(data.records['record-a'].verification)) {
          if(['valid','reason'].includes(key)) continue;
          await assertState(page.locator(`[data-property="${key}"]`),value,locale+'-presentation-override');
        }
        await page.unroute('**/assets/examples/**/results.json');
      });
      await check(`${locale}: About states mobile defaults, touch/keyboard, complete content and retained choice`, async () => {
        for(const width of [320,390]) {
          await go(width);
          const states=page.locator('.states');
          const summary=states.locator(':scope > summary');
          assert.equal(await states.getAttribute('open'),null);
          assert.equal(await page.locator('.assurance-row:visible').count(),4);
          assert.equal(await page.locator('#toggle-properties').getAttribute('aria-expanded'),'false');
          assert((await summary.boundingBox()).height>=44);
          await summary.tap();
          assert.equal(await states.getAttribute('open'),'');
          for(const description of await states.locator('dd').all()) {
            assert.equal(await description.isVisible(),true);
            assert.equal(await description.evaluate(e=>e.scrollHeight<=e.clientHeight+1),true);
          }
          await page.setViewportSize({width:1440,height:1000});
          assert.equal(await states.getAttribute('open'),'');
          await summary.focus(); await page.keyboard.press('Enter');
          assert.equal(await states.getAttribute('open'),null);
          await page.setViewportSize({width,height:1000});
          assert.equal(await states.getAttribute('open'),null);
          await summary.focus(); await page.keyboard.press('Space');
          assert.equal(await states.getAttribute('open'),'');
          await page.locator('#toggle-properties').click();
          assert.equal(await page.locator('.assurance-row:visible').count(),8);
          assert.equal(await states.getAttribute('open'),'');
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
        }
        await go(1440);
        assert.equal(await page.locator('.states').getAttribute('open'),'');
      });
      await check(`${locale}: real screenshots of affected areas only`, async () => {
        async function capture(selector,name,width) {
          const filename=`${locale}-${width}-${name}.png`;
          await page.locator(selector).screenshot({path:path.join(output,'screenshots',filename)});
          report.screenshots.push({locale,width,selector,file:'screenshots/'+filename});
        }
        for(const width of [390,1440]) {
          await go(width);
          const height=(await page.locator('#compare').boundingBox()).height;
          report.compareHeights.push({locale,width,initialSectionHeightPx:height});
          await capture('#compare','compare-initial',width);
          await capture('#assurance','assurance-initial',width);
          await capture('#records .result-panel','modify-valid',width);
          await page.selectOption('#modify-choice','record-a-modified');
          await capture('#records .result-panel','modify-invalid',width);
          if(await page.locator('#toggle-properties').getAttribute('aria-expanded')==='false') await page.locator('#toggle-properties').click();
          if(await page.locator('.states').getAttribute('open')===null) await page.locator('.states > summary').click();
          await capture('#assurance .assurance-layout','assurance-expanded',width);
          for(const key of ['changed','not-comparable']) await page.locator(`[data-comparison="${key}"] .comparison-details > summary`).click();
          await capture('#compare .comparisons','compare-details',width);
        }
      });
      await check(`${locale}: approved core palette is used`, async () => {
        const tokens = await page.evaluate(()=>{
          const style=getComputedStyle(document.documentElement);
          return ['--paper','--ink','--blue'].map(name=>style.getPropertyValue(name).trim().toUpperCase());
        });
        assert.deepEqual(tokens,['#F3F2EE','#111111','#2447FF']);
      });
      await check(`${locale}: 200% text, reduced motion, internal/external link destinations`, async () => {
        for (const width of [390, 1440]) {
          await go(width);
          await page.addStyleTag({ content: 'html { font-size: 200%; }' });
          const dimensions = await page.evaluate(() => [innerWidth,document.documentElement.scrollWidth]);
          assert.deepEqual(dimensions,[width,width], '200% text overflow');
          report.textZoom.push({locale,width,rootFontSize:'200%',scrollWidth:dimensions[1]});
        }
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
        const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(a => a.getAttribute('href')));
        for (const href of links.filter(x => x.startsWith('#'))) assert.equal(await page.locator(href).count(), 1, href);
        assert(links.includes('https://github.com/aelitium-dev/aelitium-v3/issues'));
        assert(links.includes('https://github.com/aelitium-dev/aelitium-v3/tree/v0.4.0/docs'));
        for (const href of [...new Set(links.filter(x => x.startsWith('/')))]) {
          assert.equal((await context.request.get(origin+href)).status(),200,href);
        }
      });
      await context.close();
    }
    await check('Missing fixtures and disabled JavaScript remain honest', async () => {
      for (const route of ['/','/fr/']) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.route('**/assets/examples/**/results.json', route => route.fulfill({ status:404,body:'missing' }));
        await page.goto(origin+route+'?experience=classic');
        await page.waitForTimeout(150);
        assert.match(await page.locator('#inspector .connection-status').textContent(), /not connected|indisponibles/);
        assert.equal(await page.locator('#modify-choice').isDisabled(), true);
        await assertState(page.locator('#modify-state'),'UNAVAILABLE','missing-fixtures');
        assert.equal(await page.locator('[data-property]').first().textContent(),'—');
        await context.close();
        const nojs = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
        const plain = await nojs.newPage(); await plain.goto(origin+route);
        assert.equal(await plain.locator('section').count(),9);
        assert.equal(await plain.locator('#site-nav').isVisible(),true);
        assert.equal(await plain.locator('.verdict').filter({hasText:/^VALID$/}).count(),0);
        await assertState(plain.locator('#modify-state'),'UNAVAILABLE','no-js');
        assert.equal(await plain.locator('a[href^="mailto:"]').count(),3);
        assert.equal(await plain.locator('#contact-email').isVisible(),true);
        assert.equal(await plain.locator('#feedback-flow,form,fieldset,textarea,input').count(),0);
        assert.equal(await plain.locator('.states').getAttribute('open'),null);
        await nojs.close();
      }
    });
    await check('Incomplete HTTP 200 fixtures never activate demos; rendering failure resets them', async () => {
      const cases = [
        ['wrong-language',data=>{data.language='unexpected';}],
        ['missing-comparison',data=>{delete data.comparisons['not-comparable'];}],
        ['missing-later-scenario',data=>{delete data.comparisons.invalid;}],
        ['missing-assurance-state',data=>{delete data.records['record-a'].verification.freshness;}],
        ['malformed-hash',data=>{data.comparisons.changed.result.response_hash_b=['bad'];}],
        ['missing-byte-range',data=>{delete data.inspector.byte_ranges['/output'];}],
        ['malformed-prompt',data=>{data.records['record-a'].payload.prompt='{"unexpected":true}';}],
        ['rendering-error',()=>{}],
      ];
      for (const locale of ['en','fr']) for (const [name,mutate] of cases) {
        const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
        const page=await context.newPage();
        page.on('pageerror',error=>report.errors.push(error.message));
        useLanguage(locale);
        const data=structuredClone(fixtures);mutate(data);
        if(name==='rendering-error') await page.addInitScript(()=>{
          const original=document.createElement.bind(document);
          let headings=0;
          document.createElement=(tag,...args)=>{
            if(tag==='h4' && ++headings===5) { document.createElement=original;throw Error('Injected comparison render error'); }
            return original(tag,...args);
          };
        });
        await page.addInitScript(()=>{
          window.sawActiveExample=false;
          new MutationObserver(()=>{
            const selectors='[data-field]:not(:disabled), #modify-choice:not(:disabled), #compare-choice:not(:disabled)';
            if(document.querySelector(selectors)) window.sawActiveExample=true;
          }).observe(document,{subtree:true,childList:true,attributes:true});
        });
        let fixtureStatus;
        page.on('response',response=>{if(/\/assets\/examples\/(fr\/)?results\.json$/.test(response.url())) fixtureStatus=response.status();});
        await page.route('**/assets/examples/**/results.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
        await page.goto(origin+(locale==='en'?'/':'/fr/')+'?experience=classic');
        await page.waitForFunction(()=>document.querySelector('#inspector .connection-status').textContent.includes('incomplete')||document.querySelector('#inspector .connection-status').textContent.includes('incomplètes'));
        assert.equal(fixtureStatus,200);
        assert.equal(await page.evaluate(()=>window.sawActiveExample),false,name);
        for(const selector of ['#modify-choice','#reset-example','#compare-choice']) assert.equal(await page.locator(selector).isDisabled(),true);
        assert.equal(await page.locator('[data-field]:not(:disabled)').count(),0);
        assert.equal(await page.locator('.byte,.selected-derived,.full-hash').count(),0);
        assert((await page.locator('[data-property]').allTextContents()).every(value=>value==='—'));
        for(const verdict of await page.locator('.verdict').all()) assert.match(await verdict.textContent(),/not connected|indisponibles/);
        assert.match(await page.locator('[data-assurance-availability]').textContent(),/not connected|indisponibles/);
        assert.equal(await page.locator('.comparison-details').count(),0);
        for(const value of await page.locator('.verdict,[data-property]').all()) await assertState(value,'UNAVAILABLE',locale+'-'+name);
        // A late rendering failure also leaves the existing disclosures safe to open.
        await page.locator('#canonical-step > summary').click();
        assert.equal(await page.locator('.byte').count(),0);
        report.fixtureFailures.push({locale,case:name,httpStatus:fixtureStatus,resultsCleared:true,controlsDisabled:true,activationObserved:false});
        await context.close();
      }
    });
    await check('No unexpected network methods, telemetry or browser errors', async () => {
      assert.deepEqual(report.errors, []);
      for (const request of report.requests) {
        assert.equal(request.method, 'GET');
        assert.equal(new URL(request.url).origin, origin);
      }
    });
  } finally {
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2)+'\n');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
