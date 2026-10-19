# Testing and validation

## Supported test environment
The local candidate has been verified on Linux with Node 22.22.3, npm 11.12.1 and the
runtime's built-in SQLite 3.51.3. macOS is a CI target; hosted results remain unverified.
Windows and other runtime versions are untested.

## Developer commands
Run from the repository root:

```sh
npm ci
npm run build
npm run typecheck
npm run lint
npm test
npm run demo
npm run pack:check
npm run security:scan
```

Dependency installation needs registry access or a populated npm cache.
The synthetic test suite and demo run offline after installation.

## Recorded local results
The implemented candidate passed install, build, typecheck, lint and all 34 tests.
A clean source snapshot also passed offline installation, build, typecheck, lint,
tests and demo. This was a source snapshot rather than a Git clone.

The suite includes:
- Fifty deterministic scheduler executions across all four injection sites and
  occurrence selection, without arbitrary race-creating sleeps.
- Ten repetitions of each of eight SQLite scenarios, including buggy/fixed controls,
  physical row inspection, missing-observer and ledger-consistency checks.
- CLI exit codes 0/1/2/3, real XML parsing, input/path rejection and output collisions.
- Cooperative/noncooperative cancellation, context revocation, synchronous watchdogs
  and leaked-handle cleanup.
- Report/JSONL redaction, safe error output and invalid imported-report rejection.

The eight-case demo checks expected outcomes rather than requiring every fixture to
pass. Its recorded local execution with reports was 0.858 seconds; performance elsewhere
has not been established. See [fixture evidence](fixture-evidence.md) for reproduction.

## Packaging and security checks
npm run pack:check creates a real tarball, installs it into a clean temporary consumer,
checks the installed CLI, root/subpath exports, TypeScript declarations and init/run/demo,
then removes the consumer. The recorded local check passed.

The locked dependency graph had zero npm audit findings at the recorded verification.
npm run security:scan found no matches in its limited credential patterns across working
files and generated artifacts; no Git commits existed to scan. This is not a complete
security audit. Re-run both checks before sharing a release.

## Remaining validation
Hosted Linux/macOS CI and two unfamiliar-developer onboarding trials are not verified.
A working internal integration example does not establish the under-30-minute onboarding
target. See [release readiness](release-readiness.md) for the remaining publication checks.
