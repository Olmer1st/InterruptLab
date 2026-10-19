# Release readiness — local 0.1.0 candidate
## Acceptance evidence

Gate A verifies a reproducible duplicate-effect failure and repaired control; see
[fixture evidence](fixture-evidence.md). Gate B requires ten consistent repeated runs.
Gate C covers unfamiliar-developer onboarding, which remains unverified.

| Story | Evidence |
| --- | --- |
| IL-01 scaffold | tests/cli.test.ts: init creates a runnable custom driver |
| IL-02 four sites | tests/runner.test.ts: 50 boundary/occurrence executions |
| IL-03 cooperative cancellation | runner tests: before-step and cooperative pack |
| IL-04 physical effects | runner tests: actual SQLite rows and ledger mismatch control |
| IL-05 no duplicate resume | ten repeated buggy/fixed SQLite pairs |
| IL-06 explicit forbidden barrier | late-commit control fails after acknowledgement |
| IL-07 repeatability | every SQLite pack runs ten times; no retry-to-green |
| IL-08 CI outcomes | CLI tests: 0/1/2/3, canonical reports and real XML parser |
| IL-09 timeout != canceled | API deadline and CLI synchronous-watchdog controls |
| IL-10 safe reports | metadata allowlist, redaction, JSONL and malformed report tests |

## Local verification
npm ci, build, typecheck, lint, test, demo, integration and packaging checks run on Linux
with Node 22.22.3 / npm 11.12.1. See [testing](testing.md) for evidence and limitations.
## GitHub source preview
- Personal ownership confirmed; Apache-2.0 approved with Copyright 2026 Vadim Malkin.
- GitHub commit and push authorized by the maintainer; npm publication deferred.
- Linux tested. macOS and Windows explicitly untested.
- GitHub private vulnerability reporting is enabled and verified through the repository API.
- No private conduct-reporting channel or email intake is offered for this preview.
- External onboarding trials remain unverified and are a documented preview limitation.

Supported versioned release readiness remains pending platform/onboarding evidence,
a fresh package/privacy review. These are separate
from the authorized GitHub source preview. No npm publication is authorized.

## Owner-controlled release sequence
After resolving the checklist, repeat npm ci/build/typecheck/lint/test/demo/pack:check
and audit the tarball. Keep package privacy enabled until npm publication is separately approved.
Update publication metadata and version deliberately. Only with explicit authorization: create the
v0.1.0 tag, push, and publish the inspected tarball. No automated release workflow exists.

If a bad package escapes, deprecate the affected version, publish a corrected version
after review, communicate the issue and revoke any leaked credentials immediately.
Do not assume npm unpublishing is available or rewrite history to hide the incident.
