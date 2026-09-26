"""Package the local review deliverables, including untracked source files.

No Git mutations. Explicit inclusion list; font binaries and runtime environments
are excluded. Run after tests and after updating PROTOTYPE_REPORT.md.
"""
from pathlib import Path
import hashlib
import json
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'artifacts/review/AELITIUM_site_v040_review_r2.zip'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

assert git('branch', '--show-current').strip() == b'site/v0.4.0-homepage-prototype'
assert not git('diff', '--cached', '--name-only').strip(), 'Unexpected staged changes'
files = [
    'PROTOTYPE_REPORT.md', 'index.html', 'fr/index.html', 'MESSAGING_SPEC.md',
    'assets/site.css', 'assets/site.js', 'assets/favicon.svg', 'assets/fonts/LICENSE.txt',
    'artifacts/r2/browser-results.json', 'artifacts/r2/portable-tests.txt',
    'artifacts/r2/browser-tests.txt', 'artifacts/r2/color-tokens.json',
    'artifacts/r2/supplemental-checks.json', 'artifacts/r2/ROUND_CHANGES.diff',
    'artifacts/r2/SCREENSHOTS.md',
]
for folder, suffixes in [
    ('assets/examples', {'.json', '.md'}), ('tools', {'.py'}),
    ('tests', {'.py', '.cjs'}), ('artifacts/r2/screenshots', {'.png'}),
]:
    files.extend(str(p.relative_to(ROOT)) for p in (ROOT/folder).rglob('*') if p.is_file() and p.suffix in suffixes)
files = sorted(set(files))
contents = {}
for relative in files:
    p = ROOT / relative
    assert not p.is_symlink() and p.resolve().is_relative_to(ROOT)
    assert not any(part in {'.git', '.venv', 'venv', 'node_modules', '__pycache__', '.cache'} for part in p.parts)
    assert p.suffix not in {'.ttf', '.otf', '.woff', '.woff2', '.pyc', '.zip'}
    contents[relative] = p.read_bytes()

contents['review/TRACKED_CHANGES.diff'] = git('diff', '--no-ext-diff', '--no-textconv', '--no-color', 'HEAD', '--')
status = git('status', '--short', '--untracked-files=all').decode()
# Exclude an older copy of this generated package/checksum from its own inventory.
status = '\n'.join(line for line in status.splitlines() if 'artifacts/review/' not in line)
contents['review/CHANGED_FILES.txt'] = (
    'Baseline: ' + git('rev-parse', 'HEAD').decode().strip() + '\n'
    'Branch: site/v0.4.0-homepage-prototype\n'
    'M = tracked change; ?? = untracked. No staging.\n\n' + status + '\n\n'
    'The diff covers tracked files only. New/untracked deliverables are included as full files.\n'
    'This status lists the whole working tree against HEAD, including historical R1 artifacts.\n'
    'R1 screenshots/logs are not repackaged; MANIFEST.sha256 lists exact R2 archive contents.\n'
    'Font binaries are intentionally excluded, even when listed above as untracked.\n'
    'The generated review ZIP and its checksum are not included in themselves.\n'
).encode()
contents['review/PACKAGE_NOTES.md'] = '''# Review package R2 — limited finishing round

This archive contains the actual current source, fixtures, tests, reports and
Chromium screenshots, including new/untracked files. It does not publish the site.
Only the affected areas are captured at 390 and 1440 px, EN/FR. The 320 px
regression is reported in the tests. R1 screenshots are not repackaged as R2.

Start with PROTOTYPE_REPORT.md. The screenshots were captured from the local
checkout with its Ubuntu Sans fallback loaded. Font binaries are intentionally
excluded as requested; only the license/origin text is included. An extracted
preview therefore uses the CSS system-font fallback and may differ typographically.
No fonts are downloaded automatically. Font acceptance remains pending.

To inspect the static pages, serve the extracted root:

    python3 -m http.server 8000 --bind 127.0.0.1

Open / and /fr/. Feedback/Contact remain local and disconnected. Browser tests
require an available Playwright/Chromium installation; the portable Git baseline
checks require the original checkout. The tests were executed in that checkout,
not presented as a qualification of this font-free review archive.

TRACKED_CHANGES.diff is the textual diff against HEAD. CHANGED_FILES.txt lists
tracked and untracked changes. MANIFEST.sha256 hashes every archive member except
itself. No .git directory, environments, caches, credentials or other projects are
included. artifacts/r2/ROUND_CHANGES.diff also isolates the R2 source/test/report
edits from the start of this round, including edits to untracked source files.
The prior R1 archive is preserved separately and is not included here.
'''.encode()
contents['review/MANIFEST.sha256'] = ''.join(
    f'{hashlib.sha256(data).hexdigest()}  {name}\n' for name, data in sorted(contents.items())
).encode()
DEST.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(DEST, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(contents.items()):
        archive.writestr(name, data)
with ZipFile(DEST) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(contents)
    for name, data in contents.items():
        assert archive.read(name) == data
checksum = hashlib.sha256(DEST.read_bytes()).hexdigest()
DEST.with_suffix('.zip.sha256').write_text(f'{checksum}  {DEST.name}\n')
print(json.dumps({'zip':str(DEST),'bytes':DEST.stat().st_size,'members':len(contents),'sha256':checksum,'font_binaries':0,'git_mutations':0},indent=2))
