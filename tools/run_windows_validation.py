"""Run existing local Windows browsers from WSL, in isolated temporary profiles.
Usage: python3 tools/run_windows_validation.py chrome|edge
       python3 tools/run_windows_validation.py firefox tests/firefox-bidi.cjs
Requires the already installed Windows Node and browsers. Installs nothing.
"""
from pathlib import Path
import subprocess,sys,json
root=Path(__file__).resolve().parents[1]
browser=sys.argv[1]
script=sys.argv[2] if len(sys.argv)>2 else 'tests/browser.cjs'
def win(p): return subprocess.check_output(['wslpath','-w',str(p)],text=True).strip()
exe={'chrome':r'C:\Program Files\Google\Chrome\Application\chrome.exe','edge':r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe','firefox':r'C:\Program Files\Mozilla Firefox\firefox.exe'}[browser]
out=root/'artifacts/email-contact'/f'{browser}-windows';out.mkdir(exist_ok=True)
quote=lambda s: "'"+s.replace("'","''")+"'"
command="; ".join([
 "$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()",
 "$env:PLAYWRIGHT_MODULE = "+quote(win(Path('/home/catarina-aelitium/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'))),
 "$env:BROWSER_EXECUTABLE = "+quote(exe),
 "$env:ARTIFACT_DIR = "+quote(win(out)),
 "Set-Location -LiteralPath "+quote(win(root)),
 "& 'C:\\Program Files\\nodejs\\node.exe' "+quote(win(root/script)),
 "exit $LASTEXITCODE"
])
r=subprocess.run(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command',command],capture_output=True,timeout=360)
output=(r.stdout+r.stderr).decode('utf-8',errors='replace')
(out/Path(script).with_suffix('.txt').name).write_text(output)
print(json.dumps({'browser':browser,'script':script,'rc':r.returncode,'output':output},ensure_ascii=False))
sys.exit(r.returncode)
