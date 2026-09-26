# AELITIUM messaging — website prototype v0.4.0

This local EN/FR prototype targets public release v0.4.0, commit
`3506a4fdd8adc6a4c4aec25799cd2add2b2a1f73`. Recheck the public release before
publication. The FR copy has received local language review against EN; technical identifiers
and recorded results remain unchanged. The user has accepted the R2 design,
01–09 structure and Ubuntu Sans typography.

## Product scope

AELITIUM is a library and CLI for checkable evidence from recorded AI interactions.
Verification evaluates retained evidence offline under explicit contracts.
Eight assurance dimensions are reported separately. Capture covers supported
non-streaming OpenAI, Anthropic and LiteLLM paths. Scan analyzes supported Python
LLM call patterns; it is not a bundle verifier or proof of capture completeness.

Comparison validates inputs before selecting a basis. Default v0.4.0 comparison
uses `INVOCATION_IDENTITY_V1` when both valid records have usable validated
invocation identity and binding evidence. Other supported modes/bases are documented
in the release; do not describe the default as always comparing request hashes.
The four outcomes are `UNCHANGED`, `CHANGED`, `NOT_COMPARABLE`, `INVALID_BUNDLE`.
`SAME` is a hash relation, never a comparison outcome.

## Non-claims — apply to every example and page

- Payload integrity is not historical non-modification. An internally consistent
  replacement requires an independently trusted external anchor to distinguish it.
- Signature validity is not trusted signer identity. Trust requires matching the
  verified key to an explicitly supplied external trust store.
- Invocation consistency is not provider execution or full real-world identity.
- Invocation binding is not response causation.
- Declared-time freshness evaluates the canonical timestamp only with explicit
  maximum age and UTC reference time; it is not trusted historical time.
- `authorization` is always `NOT_EVALUATED` in v0.4.0.
- Evidence does not establish truth, correctness, safety, capture completeness,
  historical occurrence, model drift, regression, provider fault or legal compliance.
- Never collapse the dimensions into a global authenticity, trust or safety badge.
- No invented customers, contact addresses, submission success or capture guarantees.

## Prepared examples — not universal product results

`assets/examples/provenance.json` identifies the public source, dependencies,
input/output file hashes and regeneration command. `raw-outputs.json` retains
stdout/stderr/return codes and verification API results. `results.json` is the
shared EN/FR view of those results. UI code selects results; it runs no verifier.

- `record-a`: synthetic mock-client capture; four consistency dimensions VALID,
  signature ABSENT, signer identity UNESTABLISHED, freshness/authorization NOT_EVALUATED.
- `record-a-copy`: same bundle, comparison UNCHANGED / RESPONSE_HASH_SAME / rc=0.
- `record-b`: another valid bundle; same selected identity, different response;
  CHANGED / RESPONSE_HASH_DIFFERENT / rc=2.
- `record-c`: another valid bundle with different recorded request;
  NOT_COMPARABLE / INVOCATION_IDENTITY_HASH_DIFFERENT / rc=1.
- `record-a-modified`: only canonical `/output` changes; expected manifest and
  stored metadata retained. Payload integrity INVALID / HASH_MISMATCH;
  comparison INVALID_BUNDLE / basis NONE / BUNDLE_VERIFICATION_FAILED / rc=2.

The first three comparison outcomes above use INVOCATION_IDENTITY_V1. Hashes are
complete in the files and copy controls. No image hashes are reused. Inspector
highlights are documented exact UTF-8 ranges in one canonical object, never digest
bytes attributed to a field. Missing example data must remain visibly unavailable.

## Direct email contact and release limits

Feedback and Contact use native mailto links to hello@aelitium.com, with exact
subjects [AELITIUM Feedback] and [AELITIUM Contact]. They open the visitor's
configured email app; the visitor sends the message there. The site sends no
email and must never report delivery. The address remains selectable/copiable.
There is no local form flow, stored form data, submission service, SMTP or Bridge
integration. GitHub Issues remains a separate actual link.

Do not advertise self-test/doctor, arbitrary bundle upload, future product features
or readiness for publication. Product wheel/sdist qualification and publication
configuration are separate tasks. This prototype does not approve Phase 2.

## Checks

Keep `guardrail.ps1` unchanged. Its actual PowerShell execution must be reported
separately from the portable complementary checks in `tests/check_site.py`.
