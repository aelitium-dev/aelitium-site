/* Prepared release outputs only. This page does not implement a verifier. */
(() => {
  'use strict';
  const fr = document.documentElement.lang === 'fr';
  const t = (en, french) => fr ? french : en;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  document.documentElement.classList.add('js');
  const experience = new URLSearchParams(location.search).get('experience');
  const guided = experience === null || experience === 'guided';
  if (experience === 'guided' || experience === 'classic') {
    $$('.languages a').forEach(anchor => {
      const url = new URL(anchor.href);
      url.searchParams.set('experience', experience);
      anchor.href = url.pathname + url.search;
    });
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let guidedAnimations = [];
  function cancelGuidedMotion() {
    guidedAnimations.forEach(animation => animation.cancel());
    guidedAnimations = [];
  }
  function guideAttention(elements) {
    cancelGuidedMotion();
    if (reducedMotion.matches) return;
    // Data and selection are already final. Only the visual cue is staggered.
    guidedAnimations = elements.map((element, index) => element.animate(
      [{ transform: 'translateY(3px)' }, { transform: 'translateY(0)' }],
      { duration: 160, delay: index * 80, easing: 'ease-out' }
    ));
  }
  reducedMotion.addEventListener('change', cancelGuidedMotion);

  function setupGuidedExperience() {
    document.documentElement.dataset.experience = 'guided';
    const steps = $('.inspector-steps');
    const fields = node('div', undefined, 'guided-fields');
    fields.append($('[data-field=request]'), $('[data-field=response]'));
    $('[data-field=request] .field-label', fields).textContent = t('View the request', 'Voir la question');
    $('[data-field=response] .field-label', fields).textContent = t('View the response', 'Voir la réponse');
    // Context remains available, without suggesting further digest associations.
    $$('.record-fields [data-field]').forEach(button => {
      const value = node('div', undefined, 'record-field');
      value.append(...button.childNodes);
      button.replaceWith(value);
    });
    $('.inspector-step > summary').textContent = t('Recorded context', 'Contexte enregistré');
    $('.inspector-step > p').remove();
    const evidence = node('div', undefined, 'guided-evidence');
    const excerpt = node('div', undefined, 'guided-canonical');
    excerpt.append(node('h3', t('Canonical bytes · excerpt', 'Octets canonicalisés · extrait')));
    const code = node('code', '—');
    code.id = 'guided-byte-excerpt';
    const range = node('p', '', 'micro');
    range.id = 'guided-byte-range';
    range.setAttribute('role', 'status');
    range.setAttribute('aria-atomic', 'true');
    excerpt.append(code, range);
    const principal = node('div');
    principal.id = 'guided-primary-hash';
    principal.append(node('p', '—'));
    evidence.append(excerpt, principal);
    const details = node('details', undefined, 'guided-inspector-details');
    details.append(node('summary', t('Context, complete bytes & all hashes', 'Contexte, octets complets et toutes les empreintes')));
    const selectionHelp = node('p', '', 'micro');
    selectionHelp.id = 'guided-selection-help';
    selectionHelp.setAttribute('role', 'status');
    const next = node('a', t('Next: try changing one word →', 'Ensuite : essayez de modifier un mot →'), 'text-link');
    next.id = 'guided-next';
    next.href = '#records';
    steps.before(node('p', t('Click the request or response to inspect its saved evidence.', 'Cliquez sur la question ou la réponse pour voir les éléments conservés.'), 'guided-instruction'), fields, selectionHelp, evidence, details, next);
    details.append(steps);
    $('#canonical-step').open = false;
    $('#derived-step').open = false;

    const grid = $('.modify-grid');
    const stored = grid.firstElementChild;
    const inspected = grid.lastElementChild;
    const result = $('#records .result-panel');
    $('#records h3').textContent = t('Change one word. See what the check detects.', 'Changez un mot et observez le résultat du contrôle.');
    $('#records h3').nextElementSibling.textContent = t('Continue reviewing the same LLM run. Keep the original evidence fixed and change one word in a copy of the response.', 'Poursuivez la revue de la même exécution LLM. Conservez les éléments d’origine et modifiez un mot dans une copie de la réponse.');
    const original = node('div', undefined, 'guided-original');
    const originalResponse = $('.sample-text', stored);
    originalResponse.previousElementSibling.remove();
    originalResponse.id = 'guided-original-response';
    original.append(node('p', t('1. Read the saved original', '1. Lisez la réponse conservée'), 'micro'), originalResponse);
    const actions = node('div', undefined, 'guided-modify-actions');
    const change = node('button', t('2. Replace three with four', '2. Remplacer trois par quatre'), 'button primary');
    change.type = 'button';
    change.id = 'change-to-four';
    change.disabled = true;
    change.setAttribute('aria-controls', 'modified-response recomputed-hash modify-state');
    $('#reset-example').setAttribute('aria-controls', 'modified-response recomputed-hash modify-state');
    $('#reset-example').textContent = t('Start again ↺', 'Recommencer ↺');
    const reset = $('#reset-example');
    actions.append(change);
    const reference = node('details', undefined, 'guided-modify-reference');
    reference.append(node('summary', t('Original evidence · fixed expected hash', 'Preuve d’origine · empreinte attendue fixe')), stored, $('#modify-reason'));
    $('#modify-choice').hidden = true;
    $('label', inspected).hidden = true;
    $('h4', inspected).remove();
    const response = $('#modified-response');
    const hashLabel = $('#recomputed-hash').previousElementSibling;
    const hash = $('#recomputed-hash');
    const prepared = node('p', t('Prepared example · results from AELITIUM v0.4.0. No verifier runs in this browser.', 'Exemple préparé · résultats d’AELITIUM v0.4.0. Aucun vérificateur ne s’exécute dans ce navigateur.'), 'example-note');
    grid.className = 'guided-modify';
    grid.replaceChildren(original, actions, response, result, reset, hashLabel, hash, reference, prepared, inspected);
  }
  if (guided) setupGuidedExperience();

  const menu = $('#menu-toggle');
  const nav = $('#site-nav');
  const narrow = matchMedia('(max-width: 760px)');
  function closeMenu(returnFocus = false) {
    nav.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
    if (returnFocus) menu.focus();
  }
  function setupMenu() {
    menu.hidden = !narrow.matches;
    closeMenu();
  }
  setupMenu();
  narrow.addEventListener('change', setupMenu);
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    nav.classList.toggle('is-open', open);
    menu.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!nav.contains(event.target) && !menu.contains(event.target)) closeMenu();
  });
  document.addEventListener('focusin', event => {
    if (!nav.contains(event.target) && !menu.contains(event.target)) closeMenu();
  });
  nav.addEventListener('click', event => {
    const anchor = event.target.closest('a');
    if (!anchor || !narrow.matches) return;
    closeMenu();
    if (anchor.hash && anchor.origin === location.origin && anchor.pathname === location.pathname) {
      const target = document.getElementById(anchor.hash.slice(1));
      if (target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
  });

  const wideInspector = matchMedia('(min-width: 1251px)');
  const setInspector = () => {
    if (guided) return;
    $('#canonical-step').open = wideInspector.matches;
    $('#derived-step').open = wideInspector.matches;
  };
  setInspector();
  wideInspector.addEventListener('change', setInspector);
  $('#explore').addEventListener('click', () => {
    if (guided) {
      $('[data-field=request]').focus({ preventScroll: true });
      return;
    }
    $('.inspector-step').open = true;
    $('.inspector-step summary').focus({ preventScroll: true });
  });

  // Native disclosures retain their accessible expanded/collapsed state.
  // Set only the initial layout; resizing must not override the visitor's choice.
  $('.states').open = !narrow.matches;
  const extra = $('#extra-properties');
  const propertiesToggle = $('#toggle-properties');
  propertiesToggle.hidden = false;
  function showProperties(expanded) {
    extra.hidden = !expanded;
    propertiesToggle.setAttribute('aria-expanded', String(!extra.hidden));
    propertiesToggle.textContent = extra.hidden
      ? t('Show all 8 properties', 'Afficher les 8 propriétés')
      : t('Show fewer properties', 'Réduire la liste');
  }
  propertiesToggle.addEventListener('click', () => showProperties(extra.hidden));
  const desktopDetails = matchMedia('(min-width: 1001px)');
  function setDesktopDetails() {
    showProperties(desktopDetails.matches);
    $$('.boundaries > details').forEach(details => { details.open = desktopDetails.matches; });
  }
  setDesktopDetails();
  desktopDetails.addEventListener('change', setDesktopDetails);

  let hashIndex = 0;
  function hashBlock(label, value, showFull = false) {
    const wrap = node('div', undefined, 'hash-block copy-group');
    wrap.append(node('span', label, 'hash-label'));
    if (!value) {
      wrap.append(node('span', t('Unavailable in this result', 'Indisponible dans ce résultat'), 'micro'));
      return wrap;
    }
    const display = node('div', undefined, 'hash-display');
    const abbreviated = node('code', value.slice(0, 12) + '…' + value.slice(-8));
    abbreviated.title = value;
    const details = node('details');
    const id = `hash-value-${++hashIndex}`;
    details.append(node('summary', t('Full value', 'Valeur complète')));
    const full = node('code', value, 'full-hash');
    full.id = id;
    full.tabIndex = 0;
    details.append(full);
    const copy = node('button', '⧉', 'hash-copy');
    copy.type = 'button';
    copy.dataset.copyTarget = id;
    copy.setAttribute('aria-label', t(`Copy full ${label}`, `Copier ${label} en entier`));
    display.append(showFull ? full : abbreviated, copy);
    const status = node('p', undefined, 'copy-status');
    status.setAttribute('role', 'status');
    wrap.append(display);
    if (!showFull) wrap.append(details);
    wrap.append(status);
    return wrap;
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy-target]');
    if (!button) return;
    const target = document.getElementById(button.dataset.copyTarget);
    const status = $('.copy-status', button.closest('.copy-group'));
    status.textContent = '';
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(target.textContent);
      status.textContent = t('Copied.', 'Copié.');
    } catch {
      const disclosure = target.closest('details');
      if (disclosure) disclosure.open = true;
      target.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = t('Copy unavailable; select the value to copy it.', 'Copie indisponible : sélectionnez la valeur pour la copier.');
    }
  });

  function renderInspector(data) {
    const record = data.records['record-a'];
    const payload = record.payload;
    const values = {
      request: JSON.parse(payload.prompt).map(message => message.content).join('\n'),
      response: payload.output,
      model: payload.model,
      parameters: t('None supplied in this example', 'Aucun paramètre fourni dans cet exemple'),
      time: payload.ts_utc,
    };
    for (const [key, value] of Object.entries(values)) {
      $(`[data-record="${key}"]`).textContent = value;
      if (key === 'request' || key === 'response') $(`[data-record="${key}"]`).lang = fr ? 'fr' : 'en';
    }
    const bytes = new TextEncoder().encode(data.inspector.canonical_utf8);
    const grid = $('#byte-grid');
    const fragment = document.createDocumentFragment();
    const byteNodes = [];
    for (let offset = 0; offset < bytes.length; offset += 16) {
      const line = node('div', undefined, 'byte-line');
      line.setAttribute('aria-hidden', 'true');
      line.append(node('span', offset.toString(16).padStart(4, '0'), 'byte-offset'));
      for (let index = offset; index < Math.min(offset + 16, bytes.length); index++) {
        const cell = node('span', bytes[index].toString(16).padStart(2, '0'), 'byte');
        byteNodes.push(cell);
        line.append(cell);
      }
      fragment.append(line);
    }
    grid.replaceChildren(fragment);
    const meta = payload.metadata;
    const derived = [
      ['ai_hash_sha256', record.manifest.ai_hash_sha256],
      ['request_hash', meta.request_hash],
      ['response_hash', meta.response_hash],
      ['invocation_identity_hash', meta.invocation_identity.hash_sha256],
    ].map(([label, value]) => {
      const block = hashBlock(label, value);
      block.dataset.derivedHash = label;
      block.id = `derived-${label}`;
      const indicator = node('span', undefined, 'derived-selection');
      indicator.hidden = true;
      block.prepend(indicator);
      return block;
    });
    $('#derived-hashes').replaceChildren(...derived);
    const pointers = { request: '/prompt', response: '/output', model: '/model', time: '/ts_utc' };
    // Select the related digest as a whole; never map any digest byte to a field.
    const relatedHashes = { request: 'request_hash', response: 'response_hash' };
    function selectField(key, scroll = true, visitorAction = false) {
      $$('[data-field]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.field === key)));
      const related = relatedHashes[key];
      derived.forEach(block => {
        const selected = block.dataset.derivedHash === related;
        block.classList.toggle('selected-derived', selected);
        const indicator = $('.derived-selection', block);
        indicator.hidden = !selected;
        indicator.textContent = selected ? t(`Selected for ${key === 'request' ? 'Request' : 'Response'}`, `Sélectionnée pour ${key === 'request' ? 'Requête' : 'Réponse'}`) : '';
      });
      const pointer = pointers[key];
      const range = data.inspector.byte_ranges[pointer];
      byteNodes.forEach((cell, index) => cell.classList.toggle('selected', !!range && index >= range.start && index < range.end));
      $('#byte-selection').textContent = range
        ? t(`${pointer} · UTF-8 bytes [${range.start}, ${range.end}) of ${bytes.length}.`, `${pointer} · octets UTF-8 [${range.start}, ${range.end}) sur ${bytes.length}.`)
        : t('No parameters were supplied. No serialized byte range is highlighted.', 'Aucun paramètre n’a été fourni. Aucune plage d’octets n’est surlignée.');
      if (related) $('#byte-selection').textContent += t(` Related derived hash: ${related}.`, ` Empreinte dérivée associée : ${related}.`);
      if (guided && related) {
        $('.guided-evidence').dataset.available = 'true';
        $('#guided-selection-help').textContent = key === 'request'
          ? t('Request selected. Below are its saved bytes and associated hash. A hash helps compare recorded data; it does not establish whether an answer is correct.', 'Question sélectionnée. Ses octets conservés et l’empreinte associée apparaissent ci-dessous. Une empreinte sert à comparer les données ; elle ne démontre pas qu’une réponse est correcte.')
          : t('Response selected. Below are its saved bytes and associated hash. Next, try changing one word in the example below.', 'Réponse sélectionnée. Ses octets conservés et l’empreinte associée apparaissent ci-dessous. Essayez ensuite de modifier un mot dans l’exemple suivant.');
        const end = Math.min(range.start + 32, range.end);
        const lines = [];
        for (let offset = range.start; offset < end; offset += 8) {
          lines.push(`${offset.toString(16).padStart(4, '0')}  ${[...bytes.slice(offset, Math.min(offset + 8, end))].map(byte => byte.toString(16).padStart(2, '0')).join(' ')}`);
        }
        const excerpt = $('#guided-byte-excerpt');
        excerpt.textContent = lines.join('\n');
        excerpt.dataset.start = range.start;
        excerpt.dataset.end = end;
        $('#guided-byte-range').textContent = t(`${pointer} · UTF-8 [${range.start}, ${end}) · excerpt of [${range.start}, ${range.end}).`, `${pointer} · UTF-8 [${range.start}, ${end}) · extrait de [${range.start}, ${range.end}).`);
        const principal = hashBlock(related, meta[related], true);
        principal.dataset.derivedHash = related;
        principal.classList.add('guided-selected-hash');
        $('#guided-primary-hash').replaceChildren(principal);
        if (visitorAction) guideAttention([$(`[data-field="${key}"]`), $('.guided-canonical'), $('#guided-primary-hash')]);
      }
      if (range && scroll && !guided) {
        const line = byteNodes[range.start].parentElement;
        grid.scrollTop += line.getBoundingClientRect().top - grid.getBoundingClientRect().top - 30;
      }
    }
    $$('[data-field]').forEach(button => {
      button.disabled = false;
      button.setAttribute('aria-controls', `${guided ? 'guided-byte-excerpt guided-primary-hash ' : ''}byte-grid${relatedHashes[button.dataset.field] ? ` derived-${relatedHashes[button.dataset.field]}` : ''}`);
      button.addEventListener('click', () => selectField(button.dataset.field, true, true));
    });
    selectField('request');
    $('#canonical-step').addEventListener('toggle', () => {
      const selected = $('[data-field][aria-pressed=true]');
      if (!guided && $('#canonical-step').open && selected) selectField(selected.dataset.field);
    });
  }

  function setState(element, state, label = state) {
    element.dataset.state = state;
    element.textContent = label;
  }

  function renderModify(data) {
    const select = $('#modify-choice');
    if (guided) {
      $('#expected-hash').replaceChildren(hashBlock('ai_hash_sha256', data.records['record-a'].manifest.ai_hash_sha256, true));
      $('#guided-original-response').textContent = data.records['record-a'].payload.output;
    }
    function render(visitorAction = false) {
      const record = data.records[select.value];
      const modified = select.value === 'record-a-modified';
      $('#modified-response').textContent = record.payload.output;
      if (!guided) $('#expected-hash').replaceChildren(hashBlock('ai_hash_sha256', data.records['record-a'].manifest.ai_hash_sha256));
      $('#recomputed-hash').replaceChildren(hashBlock('SHA-256', record.recomputed_payload_hash, guided));
      setState($('#modify-state'), record.verification.payload_integrity);
      $('#modify-reason').textContent = `record: ${select.value} / reason: ${record.verification.reason}`;
      $('#modify-explanation').textContent = modified
        ? t('The modified payload no longer matches the stored hash and evidence contract being checked.', 'Le contenu modifié ne correspond plus à l’empreinte conservée et au contrat vérifié.')
        : t('The prepared payload matches the stored hash under this check.', 'Le contenu préparé correspond à l’empreinte conservée selon ce contrôle.');
      if (guided) {
        $('#records .result-panel .eyebrow').textContent = modified
          ? t('3. Change detected', '3. Modification détectée')
          : t('3. Matches the saved record', '3. Correspond au texte conservé');
        $('#modify-explanation').textContent = modified
          ? t('The saved response says three operational risks; this copy says four. INVALID means this copy no longer matches the retained integrity reference. This check does not tell us whether the answer is true or false.', 'La réponse conservée indique trois risques opérationnels ; cette copie en indique quatre. INVALID signale que la copie ne correspond plus à la référence d’intégrité conservée. Ce contrôle ne dit pas si la réponse est vraie ou fausse.')
          : t('The copy matches the retained integrity reference. Click “Replace three with four” to change one word and see the difference.', 'La copie correspond à la référence d’intégrité conservée. Cliquez sur « Remplacer trois par quatre » pour changer un mot et voir la différence.');
      }
      if (guided && visitorAction) guideAttention([$('#modified-response'), $('#records .result-panel'), $('#recomputed-hash')]);
    }
    select.disabled = false;
    select.addEventListener('change', () => render(true));
    $('#reset-example').disabled = false;
    $('#reset-example').addEventListener('click', () => { select.value = 'record-a'; render(true); });
    if (guided) {
      $('#change-to-four').disabled = false;
      $('#change-to-four').addEventListener('click', () => { select.value = 'record-a-modified'; render(true); });
    }
    render();
  }
  function renderComparison(element, comparison) {
    const result = comparison.result;
    const overview = $('.compare-hashes', element);
    const previousDetails = $('.comparison-details', element);
    const details = node('details', undefined, 'comparison-details');
    details.open = previousDetails?.open || false;
    details.append(node('summary', t('Technical details', 'Détails techniques')));
    const description = {
      CHANGED: t('The records have the same selected comparison identity, but their response hashes differ. No cause is identified.', 'Les enregistrements ont la même identité de comparaison sélectionnée, mais leurs empreintes de réponse diffèrent. Aucune cause n’est identifiée.'),
      NOT_COMPARABLE: t('The selected comparison identities differ, so no response-change conclusion is made.', 'Les identités sélectionnées diffèrent : aucune conclusion sur un changement de réponse n’est formulée.'),
      UNCHANGED: t('The selected comparison identity hashes and selected response hashes match under this basis.', 'Selon cette base, les empreintes de l’identité de comparaison sélectionnée sont identiques entre les deux enregistrements, tout comme les empreintes de réponse sélectionnées.'),
      INVALID_BUNDLE: t('Comparison was not performed because a bundle failed verification. No comparison identity was selected.', 'La comparaison n’a pas été effectuée car un bundle a échoué à la vérification. Aucune identité de comparaison n’a été sélectionnée.'),
    };
    details.append(node('p', description[result.status], 'comparison-note'));
    const groups = [];
    for (const [dimension, hash, title] of [
      ['identity', 'invocation_identity_hash', t('Selected comparison identity', 'Identité de comparaison sélectionnée')],
      ['response', 'response_hash', t('Response hashes', 'Empreintes de réponse')],
    ]) {
      const group = node('div', undefined, 'comparison-dimension');
      group.dataset.relationship = dimension;
      group.append(node('h4', title));
      const relation = result[hash];
      const relationText = relation === 'SAME' ? t('Equal', 'Identiques')
        : relation === 'DIFFERENT' ? t('Different', 'Différentes')
          : t('Unavailable in this result', 'Indisponibles dans ce résultat');
      const relationLabel = `${relation === 'SAME' ? '= ' : relation === 'DIFFERENT' ? '≠ ' : ''}${relationText}`;
      const diagnostic = dimension === 'response' && result.status === 'NOT_COMPARABLE';
      group.append(node('p', diagnostic
        ? t('No response-change conclusion.', 'Aucune conclusion sur un changement de réponse.')
        : relationLabel, 'hash-relation'));
      groups.push(group);

      const technical = node('div', undefined, 'comparison-dimension');
      technical.dataset.hashDimension = dimension;
      technical.append(node('h4', diagnostic ? t('Response hashes · diagnostic only', 'Empreintes de réponse · diagnostic uniquement') : title));
      technical.append(node('p', relationLabel, 'hash-relation'));
      if (diagnostic) technical.append(node('p', t('These retained response hashes are shown for inspection; differing selected identities prevent a response-change conclusion.', 'Ces empreintes conservées sont affichées pour examen ; des identités sélectionnées différentes empêchent toute conclusion de changement de réponse.'), 'comparison-note'));
      if (dimension === 'identity' && comparison.b === 'record-c') technical.append(node('p', t('In this prepared example, Run B uses a different request (record-c). No temperature parameter was supplied.', 'Dans cet exemple préparé, l’exécution B utilise une requête différente (record-c). Aucun paramètre temperature n’a été fourni.'), 'comparison-note'));
      const pair = node('div', undefined, 'compare-pair');
      for (const side of ['a', 'b']) {
        const column = node('div');
        column.append(node('p', `${t('Run', 'Exécution')} ${side.toUpperCase()} · ${comparison[side]}`, 'run-label'));
        // One disclosure exposes full values directly, without nested hash disclosures.
        column.append(hashBlock(hash, result[`${hash}_${side}`], true));
        pair.append(column);
      }
      technical.append(pair);
      details.append(technical);
    }
    overview.replaceChildren(...groups);
    const panel = $('.compare-result', element);
    panel.dataset.state = result.status;
    const verdict = node('strong', undefined, 'verdict');
    setState(verdict, result.status);
    panel.replaceChildren(verdict);
    if (result.status === 'CHANGED') panel.append(node('p', t('No cause is identified.', 'Aucune cause n’est identifiée.')));
    if (result.status === 'INVALID_BUNDLE') panel.append(node('p', description[result.status]));
    const definitions = node('dl', undefined, 'comparison-metadata');
    for (const [label, key] of [['MODE', 'comparison_mode'], ['BASIS', 'comparison_basis'], ['REASON', 'comparison_reason'], ['rc', 'rc']]) {
      definitions.append(node('dt', label), node('dd', String(result[key])));
    }
    if (result.detail) definitions.append(node('dt', 'DETAIL'), node('dd', result.detail));
    details.append(definitions);
    if (previousDetails) previousDetails.replaceWith(details);
    else panel.after(details);
  }

  // Structural checks for this finite display dataset, not evidence verification.
  // Inspect every component before the first result/control is populated.
  function validateExamples(data) {
    const require = condition => { if (!condition) throw new Error('Incomplete example dataset'); };
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const text = value => typeof value === 'string' && value.length > 0;
    const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
    require(object(data) && data.release === '0.4.0' && text(data.commit));
    require(data.language === (fr ? 'fr' : 'en'));
    require(object(data.records) && object(data.comparisons) && object(data.inspector));
    const states = {
      payload_integrity: ['VALID', 'INVALID', 'ABSENT', 'NOT_EVALUATED'],
      binding_field_consistency: ['VALID', 'INVALID', 'ABSENT', 'NOT_EVALUATED'],
      invocation_identity_consistency: ['VALID', 'INVALID', 'ABSENT', 'NOT_EVALUATED'],
      invocation_binding_consistency: ['VALID', 'INVALID', 'ABSENT', 'NOT_EVALUATED'],
      signature_validity: ['VALID', 'INVALID', 'ABSENT', 'NOT_EVALUATED'],
      trusted_signer_identity: ['VALID', 'UNESTABLISHED'],
      freshness: ['VALID', 'INVALID', 'UNESTABLISHED', 'NOT_EVALUATED'],
      authorization: ['NOT_EVALUATED'],
    };
    for (const name of ['record-a', 'record-a-copy', 'record-b', 'record-c', 'record-a-modified']) {
      const record = data.records[name];
      require(object(record) && object(record.payload) && object(record.manifest) && object(record.verification));
      require(digest(record.manifest.ai_hash_sha256) && digest(record.recomputed_payload_hash));
      const payload = record.payload;
      require(['prompt', 'output', 'model', 'ts_utc'].every(key => text(payload[key])));
      const messages = JSON.parse(payload.prompt);
      require(Array.isArray(messages) && messages.length > 0 && messages.every(message => object(message) && text(message.content)));
      require(object(payload.metadata) && digest(payload.metadata.request_hash) && digest(payload.metadata.response_hash));
      require(object(payload.metadata.invocation_identity) && digest(payload.metadata.invocation_identity.hash_sha256));
      require(typeof record.verification.valid === 'boolean' && text(record.verification.reason));
      for (const [key, allowed] of Object.entries(states)) require(allowed.includes(record.verification[key]));
    }
    const inspector = data.inspector;
    require(inspector.source === 'record-a/ai_canonical.json' && text(inspector.canonical_utf8) && object(inspector.byte_ranges));
    require(object(JSON.parse(inspector.canonical_utf8)));
    const length = new TextEncoder().encode(inspector.canonical_utf8).length;
    for (const pointer of ['/prompt', '/output', '/model', '/ts_utc']) {
      const range = inspector.byte_ranges[pointer];
      require(object(range) && Number.isInteger(range.start) && Number.isInteger(range.end));
      require(range.start >= 0 && range.start < range.end && range.end <= length);
    }
    for (const [key, b] of Object.entries({ changed: 'record-b', 'not-comparable': 'record-c', unchanged: 'record-a-copy', invalid: 'record-a-modified' })) {
      const comparison = data.comparisons[key];
      require(object(comparison) && comparison.a === 'record-a' && comparison.b === b && object(comparison.result));
      const result = comparison.result;
      require(['CHANGED', 'NOT_COMPARABLE', 'UNCHANGED', 'INVALID_BUNDLE'].includes(result.status));
      require(['comparison_mode', 'comparison_basis', 'comparison_reason'].every(field => text(result[field])));
      require(Number.isInteger(result.rc) && (result.detail === undefined || text(result.detail)));
      if (result.status !== 'INVALID_BUNDLE') {
        for (const field of ['invocation_identity_hash', 'response_hash']) {
          require(['SAME', 'DIFFERENT'].includes(result[field]));
          for (const side of ['a', 'b']) require(digest(result[`${field}_${side}`]));
        }
      } else {
        require(result.invocation_identity_hash === 'UNAVAILABLE');
        for (const field of ['invocation_identity_hash_a', 'invocation_identity_hash_b', 'response_hash_a', 'response_hash_b']) require(result[field] == null);
      }
    }
  }

  function disconnectExamples() {
    if (guided) {
      cancelGuidedMotion();
      $('.guided-evidence').removeAttribute('data-available');
      $('#guided-byte-excerpt').textContent = '—';
      $('#guided-byte-excerpt').removeAttribute('data-start');
      $('#guided-byte-excerpt').removeAttribute('data-end');
      $('#guided-byte-range').textContent = '';
      $('#guided-primary-hash').replaceChildren(node('p', '—'));
      $('#guided-selection-help').textContent = t('Example unavailable. The controls are inactive.', 'Exemple indisponible. Les boutons sont inactifs.');
      $('#guided-original-response').textContent = '—';
      $('#records .result-panel .eyebrow').textContent = t('3. Result unavailable', '3. Résultat indisponible');
      $('#change-to-four').disabled = true;
    }
    const unavailable = t('Example data not connected', 'Données de l’exemple indisponibles');
    $$('[data-field]').forEach(button => {
      button.disabled = true;
      button.setAttribute('aria-pressed', 'false');
      button.removeAttribute('aria-controls');
    });
    $$('[data-record]').forEach(element => { element.textContent = '—'; });
    $('#byte-grid').replaceChildren();
    $('#derived-hashes').replaceChildren();
    $('#byte-selection').textContent = unavailable;
    for (const selector of ['#modify-choice', '#reset-example', '#compare-choice']) $(selector).disabled = true;
    $('#modify-choice').value = 'record-a';
    $('#compare-choice').value = 'unchanged';
    $('#modified-response').textContent = '—';
    $('#expected-hash').textContent = '—';
    $('#recomputed-hash').textContent = '—';
    setState($('#modify-state'), 'UNAVAILABLE', unavailable);
    $('#modify-explanation').textContent = '';
    $('#modify-reason').textContent = '';
    $$('[data-property]').forEach(element => { setState(element, 'UNAVAILABLE', '—'); });
    $$('[data-property-description]').forEach(element => { element.hidden = true; });
    $$('[data-comparison]').forEach(element => {
      $('.compare-hashes', element).replaceChildren();
      $('.comparison-details', element)?.remove();
      const panel = $('.compare-result', element);
      panel.dataset.state = 'UNAVAILABLE';
      const verdict = node('strong', undefined, 'verdict');
      setState(verdict, 'UNAVAILABLE', unavailable);
      panel.replaceChildren(verdict);
    });
    $('[data-assurance-availability]').textContent = unavailable;
    $('#inspector .connection-status').textContent = t('Example data not connected: data is unavailable or incomplete. All example results are inactive.', 'Données de l’exemple indisponibles ou incomplètes. Tous les résultats des exemples sont inactifs.');
  }

  async function connectExamples() {
    try {
      const response = await fetch(fr ? '/assets/examples/fr/results.json' : '/assets/examples/results.json', { credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('Example data unavailable');
      const data = await response.json();
      validateExamples(data);
      renderInspector(data);
      renderModify(data);
      $$('[data-property]').forEach(element => {
        setState(element, data.records['record-a'].verification[element.dataset.property]);
      });
      $$('[data-property-description]').forEach(element => { element.hidden = false; });
      for (const key of ['changed', 'not-comparable']) renderComparison($(`[data-comparison="${key}"]`), data.comparisons[key]);
      const select = $('#compare-choice');
      const renderExtra = () => renderComparison($('[data-comparison="extra"]'), data.comparisons[select.value]);
      select.disabled = false;
      select.addEventListener('change', renderExtra);
      renderExtra();
      $('[data-assurance-availability]').textContent = '';
      $('#inspector .connection-status').textContent = '';
    } catch {
      disconnectExamples();
    }
  }
  connectExamples();
})();
