# AELITIUM Messaging Spec (v1)

Purpose: keep all public copy inside the evidence integrity boundary.

## Core claim
AELITIUM produces tamper-evident evidence bundles for LLM calls and enables
offline verification of recorded outputs.

## Scope words (use these)
- evidence bundle
- recorded response
- canonicalized request input (model + messages)
- tamper-evident
- offline verification

## Boundary statements (keep explicit)
- integrity of recorded evidence, not model authenticity
- integrity is not model quality
- capture within supported integrations, not universal provenance
- drift is detected between verified captures, not timed to a precise start

## Allowed claims (examples)
- "Verify recorded LLM output offline."
- "Detect differences between recorded responses for the same canonicalized request input."
- "Hashes cover the canonicalized request input (model + messages) and recorded response."
- "Ed25519 signatures are optional and add signer authenticity when enabled."
- "Supported OpenAI-compatible call paths."

## Disallowed claims (examples)
- "Proves what the model actually said/returned/generated."
- "Any OpenAI-compatible call."
- "No config / no API key / no SDK swap."
- "Exactly when drift started."
- "Signatures are always present."
- "Closes the trust gap."

## Wording swaps
- "verify it" -> "verify the evidence"
- "response" -> "recorded response"
- "same prompt" -> "same canonicalized request input"
- "verifiable record" -> "tamper-evident evidence bundle"

## Compliance framing
Prefer: "auditability and traceability requirements make this relevant."
Avoid: "regulators are asking for this" without source.

## Quick check
Run: `powershell -ExecutionPolicy Bypass -File guardrail.ps1`
