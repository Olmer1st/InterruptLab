# Fixture evidence

The bundled fixtures demonstrate cancellation and resume behavior using synthetic local
invoice records. No customer data, credentials or invoice service is involved.

## Flow
The workflow creates an invoice, reaches an approval/checkpoint boundary and resumes.
Both variants use logical operation and idempotency key demo-42.

In the current SQLite scenarios, cancellation occurs at
after-effect-commit-before-response. The initial physical write has committed, while
the workflow treats its result as lost. Resume receives a fresh execution context.

- Buggy driver repeats the write without deduplication: inv-1 and inv-2, FAIL.
- Fixed driver reuses the stable idempotency key: inv-1 only, PASS.
- Both attempt the tool operation twice; only the fixed driver preserves one physical row.

## Reproduce
Use Node 22.22.3 from the repository root. Install and build if needed:

```sh
npm ci
npm run build
npm run demo
```

The demo checks all eight expected controls and exits 0 only when those expected
classifications match. Its expected failures do not mean every scenario passed.

Run the two resume cases directly:

```sh
node dist/runtime/cli.js run scenarios/invoice-buggy.json --format terminal,json
node dist/runtime/cli.js run scenarios/invoice-fixed.json --format terminal,json
```

The first command intentionally exits 1; the second exits 0.

| Scenario | Outcome | Committed effect IDs | Tool calls |
| --- | --- | --- | --- |
| resume/invoice-buggy | FAIL | inv-1, inv-2 | 2 |
| resume/invoice-fixed | PASS | inv-1 | 2 |

JSON output records physical rows under results[].effects, each with committed: true,
logicalOperationId, idempotencyKey, operation, runId and commit sequence.
results[].callCount distinguishes attempted calls from new effects.
effect_committed events carry the matching physical IDs and sequences.

## Save and inspect evidence
To save all report formats, select a directory that does not exist:

```sh
node dist/runtime/cli.js demo --format terminal,json,junit,markdown --out .interruptlab/fixture-evidence
node dist/runtime/cli.js report .interruptlab/fixture-evidence/run.json --format markdown
```

The report command preserves aggregate exit semantics: it exits 2 here because the
eight-case demo includes an intentional HARNESS_ERROR control.
Inspect run.json for physical state and per-rule evidence, events.jsonl for event order,
junit.xml for CI results and report.md for readable output.

## Additional controls
- Cooperative cancellation: request, observation, acknowledgement and terminal evidence.
- Noncooperative task: bounded observation without inventing a successful stop.
- Missing physical observer: INCONCLUSIVE rather than a green cardinality assertion.
- Driver exception: HARNESS_ERROR without raw exception data.
- Acknowledged cancellation followed by a forbidden write: cancel_propagated passes,
  but no_forbidden_commit_after fails after cancel_acknowledged.
- Approval/resume: checkpoint effects remain coherent without duplicate logical keys.

Completion after a cancel request is allowed when the scenario does not forbid the
observed write. The late-commit rule therefore names its barrier explicitly.

## Recorded automated evidence
The original R1 JSONL example has five independent buggy/fixed pairs in
[spike tests](../tests/spike/invoice.test.ts).
Current [runner tests](../tests/runner.test.ts) repeat all eight SQLite scenarios ten
times with fresh stores. The buggy/fixed cases are also inspected through reopened
read-only SQLite connections. Fifty scheduler executions cover all four boundary sites.
[CLI tests](../tests/cli.test.ts) verify built commands, exit codes and report formats.

Run the complete suite with npm test. Prior Linux verification recorded 34 passing tests;
[Testing](testing.md) records the environment, commands and validation limits.

## Reset and limitations
Each CLI scenario starts with a new private temporary database. The worker closes it
and the parent removes its directory on exit. Running again resets physical state
automatically. JSON reports retain the observed row delta; the temporary database is
not kept for later manual inspection. Without --out, each run saves a unique results
directory. To repeat a saved report command, choose another new --out path.

This proves only the declared synthetic fixture contracts. It does not establish remote
rollback, framework-wide checkpoint safety or exactly-once delivery for real services.
Cancellation acknowledgement is not proof of physical stopping. The CLI watchdog is
not a security sandbox; only execute trusted drivers.
