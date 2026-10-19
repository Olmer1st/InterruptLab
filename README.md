# InterruptLab
A local TypeScript regression harness for cancellation and safe resume of instrumented
asynchronous workflows. Intended for workflow developers, SDK maintainers and QA
engineers who need observable effect evidence in CI.

**Status: GitHub source preview, candidate version 0.1.0. No npm package is published.** The five development milestones
are implemented locally; release gates remain in [release readiness](docs/release-readiness.md).
No model API, cloud service, account or credentials are required.

## Quickstart
Use Node **22.22.3** (see .nvmrc) and npm **11.12.1** from the repository root:

```sh
npm ci
npm run build
npm run demo
```

The eight-case demo verifies its expected outcomes, including intentional failures:
buggy resume creates two physical invoice records (**FAIL**), idempotent resume creates
one (**PASS**), an acknowledged cancellation followed by a forbidden write **FAILS**,
and missing observations remain **INCONCLUSIVE**. All invoices are made-up local data.

Run a conclusive regression case and write CI reports:

```sh
node dist/runtime/cli.js run scenarios/invoice-fixed.json --fail-on-inconclusive --format terminal,json,junit,markdown --out .interruptlab/quickstart
node dist/runtime/cli.js report .interruptlab/quickstart/run.json --format markdown
```

Output directories must be new; choose another --out path when repeating this command.
Without --out, run/demo create a unique directory under .interruptlab/results.
Demo exits zero only if every expected control matches. Ordinary run returns nonzero
for actual failures; it does not retry until green.

## Test your workflow
```sh
node dist/runtime/cli.js init my-cancellation-test
node dist/runtime/cli.js run my-cancellation-test/scenario.json
node dist/runtime/cli.js run examples/integration/scenario.json
```

init creates a scenario and an editable JS driver with createDriver(). Adapt your
workflow by wrapping steps and injecting synthetic effect tools through ScenarioContext.
See the [integration example](examples/integration/driver.mjs),
[API](docs/api.md), [CLI/scenario reference](docs/cli.md) and [troubleshooting](docs/troubleshooting.md).
TypeScript drivers must be compiled to ESM .js before CLI loading.

## What it checks
- Deterministic cancellation before a step, after a step starts, before an effect
  commits, or after commit but before the response.
- Separate request, observation, acknowledgement and observed terminal events.
- Actual SQLite rows (default) or in-memory effects, physical IDs, logical keys and calls.
- Effect cardinality, forbidden late commits, cancellation propagation, terminal state,
  checkpoint consistency and required state observation.
- PASS / FAIL / INCONCLUSIVE / HARNESS_ERROR, with rule evidence and event sequences.
- Terminal, JSON, JUnit and Markdown reports plus an append-only JSONL event export.

Cancellation is cooperative. An acknowledged request does not prove physical stopping,
and abort never rolls back an already committed write. Missing evidence cannot produce
a conclusive pass. See [limitations](docs/limitations.md) and [fixture evidence](docs/fixture-evidence.md).

## Development
```sh
npm run typecheck
npm run lint
npm test
npm run pack:check
npm run security:scan
```

Tests include 50 deterministic scheduler executions and ten repetitions of each
SQLite scenario, negative controls, CLI exit codes, real XML parsing, watchdogs,
path restrictions, redaction and fresh-context resume.
pack:check creates and installs a tarball in a clean temporary consumer, checks its
CLI, runtime exports and TypeScript declarations, then removes that consumer.

| Environment | Status |
| --- | --- |
| Linux, Node 22.22.3, npm 11.12.1 | Tested locally |
| macOS, Node 22.22.3 | CI target; hosted run not verified |
| Windows / other Node versions | Untested |

## Boundaries and project information
Only execute trusted drivers. Child processes provide hang containment, not a security
sandbox. The bundled store is synthetic; observing arbitrary remote effects requires
a trusted application-specific oracle. No universal process interception, remote rollback,
LLM/model scoring, production payment protection, GUI or framework adapter is included.

[Product scope](docs/MVP_SCOPE.md) · [Development plan](docs/DEVELOPMENT_PLAN.md) ·
[Roadmap](ROADMAP.md) · [Changes](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) ·
[Security](SECURITY.md) · [Support](SUPPORT.md) · [Conduct](CODE_OF_CONDUCT.md) ·
[Decisions](docs/decisions.md) · [Testing](docs/testing.md).

**License:** [Apache-2.0](LICENSE). Copyright 2026 Vadim Malkin.
This is a personal open-source project. npm publication is deferred; package metadata
remains private to prevent accidental publishing. [Third-party provenance](docs/third-party.md).
