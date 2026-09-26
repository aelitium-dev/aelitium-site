"""Portable checks; not a substitute for guardrail.ps1 or browser tests."""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import unittest
from urllib.parse import urlparse, parse_qs
ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / 'assets/examples'
DATA = json.loads((EXAMPLES / 'results.json').read_text(encoding='utf-8'))
RAW = json.loads((EXAMPLES / 'raw-outputs.json').read_text(encoding='utf-8'))
class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.elements = []
        self.feed(path.read_text(encoding='utf-8'))
    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))
class WebsiteChecks(unittest.TestCase):
    def test_languages_structure_links_and_metadata(self):
        expected = ['product','records','assurance','compare','offline','use','boundaries','release','feedback']
        for language, relative in [('en','index.html'),('fr','fr/index.html')]:
            with self.subTest(language=language):
                p = Page(ROOT / relative)
                ids = [a['id'] for _, a in p.elements if 'id' in a]
                self.assertEqual(len(ids), len(set(ids)), 'duplicate IDs')
                self.assertEqual([a['id'] for tag,a in p.elements if tag == 'section'], expected)
                for tag in ['header','main','footer','h1']:
                    self.assertEqual(sum(t == tag for t,_ in p.elements), 1)
                self.assertEqual(p.elements[0][1]['lang'], language)
                canonical = [a['href'] for t,a in p.elements if t=='link' and a.get('rel')=='canonical']
                self.assertEqual(canonical, ['https://aelitium.com/' + ('fr/' if language=='fr' else '')])
                self.assertEqual({a.get('hreflang') for t,a in p.elements if t=='link' and a.get('rel')=='alternate'}, {'en','fr','x-default'})
                for tag,a in p.elements:
                    for key in ['href','src']:
                        if key not in a: continue
                        url = a[key]
                        self.assertNotEqual(url, '#')
                        if url.startswith('#'): self.assertIn(url[1:], ids)
                        elif url.startswith('/'): self.assertTrue((ROOT/urlparse(url).path.lstrip('/')).exists(), url)
                        elif url.startswith('mailto:'):
                            self.assertEqual(tag, 'a')
                            self.assertEqual(urlparse(url).path, 'hello@aelitium.com')
                            self.assertIn(parse_qs(urlparse(url).query), [
                                {'subject':['[AELITIUM Feedback]']},
                                {'subject':['[AELITIUM Contact]']},
                            ])
                        else: self.assertEqual(urlparse(url).scheme, 'https')
                    if tag=='script' or (tag=='link' and a.get('rel')=='stylesheet'):
                        self.assertTrue(a.get('src',a.get('href','')).startswith('/'))
                self.assertNotIn('v0.3.0', (ROOT/relative).read_text(encoding='utf-8'))
    def test_feedback_email_links_replace_local_form(self):
        for relative in ['index.html', 'fr/index.html']:
            page = Page(ROOT / relative)
            links = [a for tag,a in page.elements if tag=='a' and 'data-email' in a]
            self.assertEqual([a['data-email'] for a in links], ['feedback','contact','contact'])
            self.assertTrue(all(a.get('aria-describedby')=='email-client-note' for a in links))
            self.assertTrue(any(a.get('id')=='contact-email' for _,a in page.elements))
            self.assertTrue(any(a.get('data-copy-target')=='contact-email' for _,a in page.elements))
            self.assertFalse(any(tag in ['form','fieldset','textarea','input'] for tag,_ in page.elements))
            self.assertNotIn('feedback-flow', (ROOT/relative).read_text(encoding='utf-8'))
        self.assertNotIn('feedback-flow', (ROOT/'assets/site.js').read_text(encoding='utf-8'))

    def test_fixture_file_digests(self):
        for locale in ('en', 'fr'):
            with self.subTest(locale=locale):
                EXAMPLES = ROOT / 'assets/examples' / ('fr' if locale == 'fr' else '')
                DATA = json.loads((EXAMPLES/'results.json').read_text(encoding='utf-8'))
                RAW = json.loads((EXAMPLES/'raw-outputs.json').read_text(encoding='utf-8'))
                provenance = json.loads((EXAMPLES/'provenance.json').read_text(encoding='utf-8'))
                self.assertEqual(provenance['commit'], '3506a4fdd8adc6a4c4aec25799cd2add2b2a1f73')
                for relative, expected in provenance['files'].items():
                    self.assertEqual(hashlib.sha256((EXAMPLES/relative).read_bytes()).hexdigest(), expected, relative)
    def test_served_results_match_recorded_release_outputs(self):
        for locale in ('en', 'fr'):
            with self.subTest(locale=locale):
                EXAMPLES = ROOT / 'assets/examples' / ('fr' if locale == 'fr' else '')
                DATA = json.loads((EXAMPLES/'results.json').read_text(encoding='utf-8'))
                RAW = json.loads((EXAMPLES/'raw-outputs.json').read_text(encoding='utf-8'))
                for key, comparison in DATA['comparisons'].items():
                    raw = RAW['compare-'+key]
                    self.assertEqual(comparison['result'], json.loads(raw['stdout']))
                    self.assertEqual(comparison['result']['rc'], raw['rc'])
                    self.assertEqual(raw['stderr'], '')
                for name, record in DATA['records'].items():
                    self.assertEqual(record['verification'], RAW['api-verify-'+name]['result'])
                    self.assertEqual(record['payload'], json.loads((EXAMPLES/name/'ai_canonical.json').read_text(encoding='utf-8')))
                    self.assertEqual(record['manifest'], json.loads((EXAMPLES/name/'ai_manifest.json').read_text(encoding='utf-8')))
                    self.assertEqual(record['verification']['authorization'], 'NOT_EVALUATED')
                    cli = RAW['verify-'+name]
                    if record['verification']['valid']:
                        output = json.loads(cli['stdout'])
                        for dimension in ['payload_integrity','binding_field_consistency','invocation_identity_consistency','invocation_binding_consistency','signature_validity','trusted_signer_identity','freshness','authorization']:
                            self.assertEqual(record['verification'][dimension], output[dimension])
                        self.assertEqual(cli['rc'], 0)
                    else:
                        self.assertEqual(cli['rc'], 2)
                        self.assertIn('HASH_MISMATCH', cli['stdout'])
                        self.assertIn('PAYLOAD_INTEGRITY=INVALID', cli['stdout'])
    def test_fixed_reference_modification_and_comparison_identities(self):
        for locale in ('en', 'fr'):
            with self.subTest(locale=locale):
                EXAMPLES = ROOT / 'assets/examples' / ('fr' if locale == 'fr' else '')
                DATA = json.loads((EXAMPLES/'results.json').read_text(encoding='utf-8'))
                RAW = json.loads((EXAMPLES/'raw-outputs.json').read_text(encoding='utf-8'))
                a, changed = DATA['records']['record-a'], DATA['records']['record-a-modified']
                self.assertEqual(a['manifest'], changed['manifest'])
                self.assertEqual(a['payload']['metadata'], changed['payload']['metadata'])
                self.assertEqual([k for k in a['payload'] if a['payload'][k]!=changed['payload'][k]], ['output'])
                self.assertNotEqual(a['recomputed_payload_hash'], changed['recomputed_payload_hash'])
                for key, outcome, rc in [('changed','CHANGED',2),('not-comparable','NOT_COMPARABLE',1),('unchanged','UNCHANGED',0),('invalid','INVALID_BUNDLE',2)]:
                    result = DATA['comparisons'][key]['result']
                    self.assertEqual((result['status'], result['rc']), (outcome, rc))
                r = DATA['comparisons']['changed']['result']
                self.assertEqual(r['invocation_identity_hash_a'], r['invocation_identity_hash_b'])
                self.assertNotEqual(r['response_hash_a'], r['response_hash_b'])
    def test_exact_canonical_byte_mapping(self):
        for locale in ('en', 'fr'):
            with self.subTest(locale=locale):
                EXAMPLES = ROOT / 'assets/examples' / ('fr' if locale == 'fr' else '')
                DATA = json.loads((EXAMPLES/'results.json').read_text(encoding='utf-8'))
                RAW = json.loads((EXAMPLES/'raw-outputs.json').read_text(encoding='utf-8'))
                inspector = DATA['inspector']
                raw = (EXAMPLES/inspector['source']).read_bytes()
                encoded = inspector['canonical_utf8'].encode()
                self.assertEqual(encoded+b'\n', raw)
                parsed = json.loads(encoded)
                for pointer, span in inspector['byte_ranges'].items():
                    self.assertEqual(json.loads(encoded[span['start']:span['end']]), parsed[pointer[1:]])
                self.assertEqual(hashlib.sha256(encoded).hexdigest(), DATA['records']['record-a']['manifest']['ai_hash_sha256'])
    def test_domain_workflow_and_guardrail_unchanged(self):
        files = ['CNAME','googlebf23e04a7229ed0b.html','guardrail.ps1']
        files += [str(p.relative_to(ROOT)) for p in (ROOT/'.github/workflows').glob('*')]
        for file in files:
            original = subprocess.check_output(['git','show',f'81dd9b4:{file}'], cwd=ROOT)
            self.assertEqual((ROOT/file).read_bytes(), original, file)
        self.assertEqual(subprocess.check_output(['git','diff','--cached','--name-only'],cwd=ROOT), b'')
    def test_complementary_claims_and_network_surface(self):
        guard = (ROOT/'guardrail.ps1').read_text(encoding='utf-8')
        patterns = re.findall(r'"([^"]+)"', guard.split('$patterns = @(')[1].split(')')[0])
        for file in [ROOT/'index.html', ROOT/'fr/index.html', *(ROOT.glob('*.md'))]:
            if file.name=='MESSAGING_SPEC.md': continue
            content=file.read_text(encoding='utf-8').lower()
            for pattern in patterns: self.assertNotIn(pattern.lower(), content, f'{file.name}: {pattern}')
        js=(ROOT/'assets/site.js').read_text(encoding='utf-8')
        self.assertEqual(js.count('fetch('), 1)
        self.assertEqual(re.findall(r"'(/assets/examples/(?:fr/)?results\.json)'", js), ['/assets/examples/fr/results.json', '/assets/examples/results.json'])
        for forbidden in ['localStorage','sessionStorage','sendBeacon','XMLHttpRequest','WebSocket','document.cookie']:
            self.assertNotIn(forbidden, js)
if __name__ == '__main__': unittest.main(verbosity=2)
