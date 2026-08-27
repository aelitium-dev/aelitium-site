# AELITIUM Messaging Spec

Purpose: keep public copy inside the current evidence-consistency and release-state boundaries.

## Core claim

AELITIUM is a library and CLI for producing and verifying internally consistent, offline-verifiable evidence bundles for recorded AI interactions.

## Release wording

- Latest actual release: v0.3.0
- v0.3.0 is tagged, released on GitHub, and published to PyPI.

## Scope words

Prefer:

- evidence bundle
- recorded request and response fields
- v1 selected-field request identity
- internal consistency
- recorded evidence contract
- offline verification
- mathematical signature validity
- externally supplied trust store

## Assurance boundaries

- payload integrity != historical non-modification
- signature validity != trusted signer identity
- invocation consistency != provider execution
- invocation binding != causation
- freshness VALID != trusted historical time
- authorization != execution
- technical VALID != legal compliance
- evidence set != completeness of real-world events

## Allowed claims

- “Check the internal consistency of a recorded AI evidence bundle offline.”
- “Detect changes inconsistent with the recorded evidence contract, hashes, and present signature material.”
- “Compare recorded response hashes for the same request hash.”
- “AELITIUM reports eight separate assurance dimensions.”
- “Trusted signer identity requires a matching key in an explicitly supplied external trust store.”

## Disallowed claims

- “Proves an AI action happened.”
- “Proves the provider executed the invocation.”
- “Proves the request caused the response.”
- “Proves the bundle was never modified.”
- “Proves complete capture.”
- “Proves trusted historical time.”
- “Proves regulatory or legal compliance.”
- “Signatures automatically establish a trusted signer.”

## Wording swaps

- “detects post-capture modification” -> “detects changes inconsistent with the recorded evidence contract”
- “same request” -> “same request hash” or “same v1 selected-field request identity”
- “response” -> “recorded response”
- “verify the result” -> “check the bundle's internal consistency”
- “authentic signer” -> “mathematically valid signature” unless an external trust-store match is explicitly in scope

## Compliance framing

Technical evidence may support an audit, governance, or compliance workflow. It does not itself establish legal or regulatory compliance.

## Quick check

Run: `powershell -ExecutionPolicy Bypass -File guardrail.ps1`
