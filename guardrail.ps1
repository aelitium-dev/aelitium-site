Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$target = "index.html"
$patterns = @(
  "what the model actually",
  "exactly when",
  "any OpenAI-compatible",
  "no config",
  "no API key",
  "verify --out",
  "proves what the model",
  "exactly what the model"
)

if (-not (Get-Command rg -ErrorAction SilentlyContinue)) {
  Write-Host "rg not found. Install ripgrep and re-run."
  exit 2
}

if (-not (Test-Path $target)) {
  Write-Host "Missing target file: $target"
  exit 2
}

$found = $false

foreach ($pattern in $patterns) {
  $matches = rg -n -i -F -e $pattern -- $target
  if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Match for pattern: $pattern"
    Write-Host $matches
    $found = $true
  } elseif ($LASTEXITCODE -eq 2) {
    Write-Host "rg error while searching for: $pattern"
    exit 2
  }
}

if ($found) {
  Write-Host ""
  Write-Host "Guardrail failed."
  exit 1
}

Write-Host "Guardrail passed."
exit 0
