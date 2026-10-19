# InterruptLab five-round development plan

Development milestones and acceptance checks for the local v0.1 candidate.
Use [MVP scope](MVP_SCOPE.md) for product behavior, [decisions](decisions.md) for
implementation choices and [testing](testing.md) for recorded evidence.

## Working approach
Treat rounds as milestones. Inspect existing code before changes, reuse shared utilities,
and update tests and documentation when contracts change. Preserve unrelated user work.
Keep synthetic scenarios offline after dependency installation and use explicit barriers
instead of sleeps to create execution order.

Ordinary local implementation work can span modules and earlier rounds. Remote pushes,
publication, legal changes and destructive shared-history operations require explicit
maintainer authorization. Do not infer completion from this plan: record actual results.

## Milestones and acceptance
| Round | Delivery | Engineering acceptance | Recorded evidence |
| --- | --- | --- | --- |
| R1 | Strict TypeScript/ESM npm workspaces, events/contracts, persistent buggy/fixed resume fixture, README and smoke CI | Install/build/typecheck/test succeed; at least five independent buggy/fixed pairs; documented state inspection/reset | [Fixture evidence](fixture-evidence.md) |
| R2 | runScenario/driver/context API, four boundary sites, cooperative lifecycle, deadlines and JSONL recorder | Fifty deterministic executions; single targeted occurrence; missing boundary/terminal never passes; failures bounded | [Runner tests](../tests/runner.test.ts) |
| R3 | SQLite oracle, effect ledger/calls, resume checks and six rule families | Ten repetitions of buggy/fixed physical rows; missing observer and ledger mismatch fail closed; forbidden-write contract is explicit | [Runner tests](../tests/runner.test.ts) |
| R4 | Validated YAML/JSON, init/run/demo/report, canonical artifacts and four report formats | Codes 0/1/2/3, real XML parsing, malformed input/path rejection, redaction and installed entrypoints | [CLI tests](../tests/cli.test.ts) |
| R5 | Timeout/cleanup/privacy hardening, clean install/tarball, integration example and release documentation | Reproduce P0 acceptance evidence, inspect package/types/bin, record platform and onboarding gaps accurately | [Testing](testing.md) |

All five local engineering milestones are implemented. This does not mark hosted CI,
user trials, legal approval or publication as completed.

## Evidence gates
Gate A is the reproducible synthetic failure and repaired control, not an external
assessment. Gate B requires ten consistent independent runs. If either fails, repair
the fixture, scheduler or observation model before adding features.

Gate C requires documentation-only integration trials with two unfamiliar developers.
An internal example does not substitute for those trials. Keep the result unverified
until real evidence is available.

## Baseline developer checks
From the repository root on the pinned Node runtime:

```sh
npm ci
npm run build
npm run typecheck
npm run lint
npm test
npm run demo
```

Packaging and security review use npm run pack:check, npm audit and
npm run security:scan. The pattern scanner is deliberately limited.
Read-only CI targets Linux and macOS; hosted results must be recorded separately.

## Project documentation and validation
Keep scope, API/config contracts, reproducible fixture instructions and testing guidance
current. Record only observed results and identify unverified platforms or onboarding
trials. Keep contributor guidance, support boundaries, reporting routes and licensing
requirements in their project documents.

## Release sequence
The maintainer approved personal ownership, Apache-2.0 and a GitHub-only source preview.
Enable GitHub private security reporting through a repository administrator. Before a
supported versioned release, obtain platform/onboarding evidence and rerun
install/build/typecheck/lint/tests/demo and packaging checks.
Review the distributable, dependency notices, privacy behavior and release notes.
Tag, push and publish only after explicit authorization. See
[release readiness](release-readiness.md) for the current project-specific checklist.

## Later work
Framework adapters, parallel scheduling, HTML visualization and additional platforms
are deferred. Track them in [ROADMAP](../ROADMAP.md); do not silently expand the v0.1
acceptance contract.
