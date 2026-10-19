# CLI and scenario reference
Run node dist/runtime/cli.js --help from a built source checkout. An installed tarball
provides interruptlab through its npm bin mapping.

## Commands
- init [new-directory]: create scenario.json and driver.mjs; refuses existing directories.
- run <file|directory>: validate every scenario/entry first, then execute sequentially.
- demo: self-check eight bundled synthetic controls, including expected bad outcomes.
- report <run.json>: validate schema/outcome consistency, render without executing drivers.

Flags: --seed unsigned-integer (0–2147483647), --format terminal,json,junit,markdown,
--out NEW_DIRECTORY, --fail-on-inconclusive, --help, --version.
run/demo save run.json and events.jsonl to --out, or a unique .interruptlab/results child.
Requested file renderers add junit.xml, report.md and/or terminal.txt.
report writes only with --out; otherwise it prints requested formats.
Outputs use private new directories and temporary-file/rename writes. Existing output
directories are errors; earlier artifacts are never replaced. Interrupted output may
leave an incomplete directory: inspect it and choose a fresh directory when rerunning.

Exit policy for run/report: 0 no known failures, 1 failed invariant, 2 harness/config error,
3 inconclusive with --fail-on-inconclusive. Precedence 2 > 1 > 3 > 0.
INCONCLUSIVE always prints a warning and is JUnit skipped, never a passing testcase.
demo exits 0 only if the documented expected statuses match; otherwise 2.
The entire eight-pack directory intentionally exits 2 because it includes a driver error.

## Version-one configuration
JSON or YAML; strict unknown-key rejection. Example:
```yaml
schemaVersion: 1
id: invoice/cancel-after-commit
driver: invoice-fixed
fixture: sqlite
seed: 42
timeoutMs: 2000
stepTimeoutMs: 1000
cancel:
  at: after-effect-commit-before-response
  operation: create-invoice
  occurrence: 1
  graceMs: 500
resume:
  enabled: true
assertions:
  - type: effect_count
    operation: create-invoice
    groupBy: idempotencyKey
    key: demo-42
    exactly: 1
  - type: observed_terminal_state
    anyOf: [completed, canceled]
  - type: observation_required
    observer: fixture-snapshot
```

Specify exactly one of driver or entry. Built-ins: invoice-buggy, invoice-fixed,
cooperative, noncooperative, missing-observer, driver-error, late-commit, approval.
entry is a relative .js/.mjs file exporting createDriver(). Resolve it relative to the
scenario, with real filesystem containment inside the invoking project. Paths cannot
escape through symlinks. Compile TypeScript before loading. Only trusted drivers.

fixture: sqlite (default) or memory. IDs/selectors are bounded ASCII metadata, not
arbitrary payloads. cancel selects an operation and positive occurrence at exactly one of:
before-step, after-step-start, before-effect-commit, after-effect-commit-before-response.
A nonexistent selector or occurrence is INCONCLUSIVE, never silently ignored.

Rules:
- effect_count: operation, groupBy idempotencyKey, exactly nonnegative integer, optional key.
  Without key, test every observed key. If no key exists, positive cardinality is
  INCONCLUSIVE; specify key when asserting existence/absence of a particular operation.
- no_forbidden_commit_after: barrier cancel_requested/cancel_observed/cancel_acknowledged/
  execution_terminated; optional operation. Missing barrier/state is INCONCLUSIVE.
- cancel_propagated: ordered request, observation and acknowledgement.
- observed_terminal_state: anyOf completed/canceled/failed.
- observation_required: observer fixture-snapshot.
- resume_checkpoint_consistency: retained checkpoint effects without duplicate logical keys.

redact is an optional array of dotted metadata paths, such as effects.0.idempotencyKey
or events.3.logicalOperationId. Only scalar identifier fields under effects/events
are replaceable; structural fields, numeric evidence and classifications cannot be hidden.
Never put real secrets in identifiers or fixtures.

## Artifact contract
run.json: schemaVersion 1, results[]. Each result includes scenarioId/runId, seed,
classification, per-rule classification/message/eventSequences, event envelope, effects,
callCount, checkpoint, boundaryReached, terminal, initialFixtureHash, environment
(Node/platform/InterruptLab version), reproduction command and limitations.
Physical rows contain effectId, logicalOperationId, idempotencyKey, operation, commit
sequence, runId and committed: true. The before state is a verified empty per-run fixture, represented
by its SHA-256; effects is the observed delta, or null when visibility is unavailable.
No input arguments, raw payloads, full environment or arbitrary exception text are persisted.

Limits: 64 KiB scenario, 64 scenario files, recursive depth 4, YAML alias cap 20,
64 rules per scenario, 10000 events/effects, 128 KiB CLI evidence per run,
16 MiB imported/generated JSON report. Oversized evidence fails closed as HARNESS_ERROR.
JUnit encodes FAIL as failure, HARNESS_ERROR as error and INCONCLUSIVE as skipped.
JSON is canonical; Markdown, terminal and JUnit use the same redacted results.
Before 1.0, schema/API changes will be documented in CHANGELOG.
