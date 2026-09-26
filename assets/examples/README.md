# Prepared examples — AELITIUM v0.4.0

These are synthetic, precomputed website examples, not observations of provider
execution. English consumes `results.json`; French consumes `fr/results.json`.
Each language has separately captured bundles, CLI outputs and provenance.
The browser selects stored
results and visualizes bytes; it does not run the Python verifier.

Source: [public v0.4.0 tag](https://github.com/aelitium-dev/aelitium-v3/tree/v0.4.0),
resolved via GitHub API to commit `3506a4fdd8adc6a4c4aec25799cd2add2b2a1f73`.
The tag resolution responses are retained in `source-tag*.json`. This identifies
the source; it is not a claim that the tag's signing identity was established.
`provenance.json` records the downloaded source archive SHA-256, engine source
file digests, dependency versions, data file digests and executed command.
The installed engine files were compared byte for byte with the release archive.

## Preparation

The report example was regenerated in the isolated `work/fixtures-venv` from
`work/release-v040/aelitium-v3-0.4.0` in the Codex Windows workspace. The protected
product checkout and the WSL site checkout were not used. The earlier document
example was prepared in separate `/tmp` source and virtual-environment folders.
The source was downloaded from the recorded archive URL, extracted, and installed
with its dependencies only in that temporary virtual environment. Nothing was
installed globally. A source install for fixture generation is not clean wheel
and sdist release qualification.

The generator uses the release's `engine.capture.openai.capture_chat_completion`
with a synthetic client returning a fixed response. The clock is fixed to a
**declared example timestamp**, `2026-09-03T12:00:00Z`. Credential environment
variables are cleared and sockets are disabled during mock capture. The request
model is `gpt-4o-mini`; this does not claim that this model actually produced these
sentences. Additional parameters were not supplied.

The exact executed command, platform, Python/dependency versions, generator
digest and source/data digests are recorded in `provenance.json`. Reproduction
from the site root with a separate venv containing the pinned release:

```sh
<isolated-venv-python> tools/prepare_fixtures.py --source-archive <v0.4.0-archive.tar.gz> --language en
<isolated-venv-python> tools/prepare_fixtures.py --source-archive <v0.4.0-archive.tar.gz> --language fr
```

To regenerate, download the same public source archive and install it in a
separate venv with the versions in `provenance.json`, then run the command above
from the site root. The archive defaults to `/tmp/aelitium-site-v040.tar.gz` if
the option is omitted. Regeneration
is optional; the static site uses the retained files without Python dependencies.
Before writing fixtures, the generator checks the pinned archive SHA-256 and
refuses an installed engine that differs from that archive. On Windows, only
transport CRLF is normalized to LF, preserving canonical content and hashes.

## Records and results

| Record / comparison | Actual result | Basis | Reason | CLI rc |
|---|---|---|---|---|
| A verified | Four consistency dimensions VALID | — | OK (API) | 0 |
| A vs A-copy | UNCHANGED | INVOCATION_IDENTITY_V1 | RESPONSE_HASH_SAME | 0 |
| A vs B | CHANGED | INVOCATION_IDENTITY_V1 | RESPONSE_HASH_DIFFERENT | 2 |
| A vs C | NOT_COMPARABLE | INVOCATION_IDENTITY_V1 | INVOCATION_IDENTITY_HASH_DIFFERENT | 1 |
| Modified A verified | payload_integrity INVALID | — | HASH_MISMATCH | 2 |
| A vs modified A | INVALID_BUNDLE | NONE | BUNDLE_VERIFICATION_FAILED | 2 |

The scenario is a platform team reviewing a retained LLM run. Its selection follows
the previously approved primary audience (AI / Platform Engineering); it is an
illustration, not an observed customer case or evidence of market demand.

A asks “What is the main conclusion of this incident report? Findings: duplicate requests, unhandled timeouts, and unredacted prompt logs.” and records “The report identifies three operational risks.”
The report excerpt is included in the request. The three concrete findings give
the answer context. No real incident, report, or provider execution is claimed.
French uses a translated request with the same three findings. Its recorded
response is “Le rapport relève trois risques opérationnels.”
The response states the count without repeating the list, so Modify focuses on
the changed word and its integrity result. The original findings remain in the request.
Modify replaces only “trois” with “quatre”. French
canonical bytes, byte offsets and hashes are generated separately by v0.4.0;
English hashes are never presented as covering the French translation.
`fr/provenance.json` and `fr/raw-outputs.json` retain that generation's evidence.
The root provenance covers English files only, excluding the `fr/` directory.

A, B and C are separate internally valid bundles. A-copy is a byte-identical copy.
B changes only the word “three” to “four” through a new mock capture. C asks
“How many operational risks does this incident report identify? Findings: duplicate requests, unhandled timeouts, and unredacted prompt logs.”, changing the selected request.
This preserves the four original comparison outcomes without claiming that the
changed output is correct or diagnosing a model regression.
Modified A changes **only `/output`** from “three” to “four”; its manifest and all
stored metadata remain fixed. The modified canonical payload hash is recomputed
for display by the release serializer, without replacing the expected manifest.

`raw-outputs.json` retains the actual argv, stdout, stderr and return code of
`python -m engine.ai_cli verify-bundle <record> --json` and
`python -m engine.ai_cli compare record-a <record> --json`.
Comparison results are copied verbatim from that JSON. Verification dimensions
come from the same release's `verify_ai_bundle(...).assurance_dict()`. Its invalid
CLI result remains key/value text, recorded as emitted, not rebranded as JSON.
The UI never reconstructs missing INVALID_BUNDLE hash values from the bad input.

## Exact byte mapping

The inspector's source is `record-a/ai_canonical.json`, excluding the single final
file newline. The matrix contains all canonical UTF-8 bytes. Its source link exposes
the complete object. `inspector.byte_ranges` stores zero-based, end-exclusive
ranges of top-level **serialized values**, including their JSON quotes/escapes.

- Request → `/prompt`, a JSON-encoded string containing the message array.
- Response → `/output`.
- Model → `/model`.
- Recorded at → `/ts_utc`, a declared time.
- Parameters → no range, because none were supplied in this capture path.

The generator measures canonical UTF-8 prefix/value lengths with the release's
serializer and asserts each resulting slice. Portable tests decode each slice
and compare it to the source value. No digest byte is assigned to a field.

`ai_hash_sha256` covers the complete canonical payload. Request/response hashes
cover the release-selected model/messages and response content/model respectively.
Invocation identity covers its versioned format, surface, mode and selected
request. Full hashes remain available through disclosure and clipboard controls.

## Boundaries

The reference screenshots supplied composition only. None of their illustrative
hashes are runtime data. The historical drift demo was not used as an invocation
identity fixture. These examples do not establish output truth, provider execution,
causation, completeness, historical time, authorization or legal compliance.
