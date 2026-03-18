$ErrorActionPreference = "Stop"

$targets = @("index.html", "*.md")
$excludeFiles = @(
  "MESSAGING_SPEC.md"
)

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
$files = @()

foreach ($target in $targets) {
  $items = Get-ChildItem -Path . -Recurse -File -Filter $target
  foreach ($item in $items) {
    if ($excludeFiles -contains $item.Name) { continue }
    $files += $item
  }
}

$files = $files | Sort-Object -Property FullName -Unique

if ($files.Count -eq 0) {
  Write-Error "No files matched the guardrail targets."
  exit 1
}

foreach ($file in $files) {
  foreach ($pattern in $patterns) {
    $matches = Select-String -Path $file.FullName -Pattern $pattern -SimpleMatch
    if ($matches) {
      $hits += $matches
    }
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
