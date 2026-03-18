$ErrorActionPreference = "Stop"

$target = "index.html"

if (-not (Test-Path $target)) {
  Write-Error "index.html not found"
  exit 1
}

$patterns = @(
  "proves what the model actually",
  "what the model actually said",
  "what the model actually returned",
  "exactly what the model generated",
  "closes the trust gap",
  "no trust gap",
  "captured at call time",
  "after capture",
  "since capture",
  "at generation time",
  "verify --out",
  "any OpenAI-compatible",
  "No config",
  "No API key",
  "exactly when"
)

$hits = @()

foreach ($pattern in $patterns) {
  $matches = Select-String -Path $target -Pattern $pattern -SimpleMatch
  if ($matches) {
    $hits += $matches
  }
}

if ($hits.Count -gt 0) {
  Write-Host "[FAIL] overclaim patterns found:" -ForegroundColor Red
  $hits | ForEach-Object {
    Write-Host ("{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim())
  }
  exit 1
}

Write-Host "[PASS] no overclaim patterns found" -ForegroundColor Green
exit 0
