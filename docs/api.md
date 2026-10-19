# TypeScript API — provisional v0.1
The root package is interruptlab. Private @interruptlab/* workspaces are development
modules, not separately released npm packages. Root exports are tested from a tarball:
interruptlab, interruptlab/fixtures, interruptlab/driver-node, interruptlab/reporter.
Before 1.0, changes may break callers; record them in CHANGELOG and decisions.

```ts
import { runScenario, type AgentDriver, type ScenarioInput } from 'interruptlab';
import { MemoryEffectStore } from 'interruptlab/fixtures';

const input: ScenarioInput = {
  schemaVersion: 1, id: 'my-workflow', driver: 'invoice-fixed',
  assertions: [{ type: 'observed_terminal_state', anyOf: ['completed'] }],
};
let terminal: 'completed' | undefined;
const driver: AgentDriver = {
  async start(ctx) {
    await ctx.step('read', async () => { ctx.signal.throwIfAborted(); });
    terminal = 'completed';
  },
  async requestCancel(reason) { void reason; },
  async observe() { return terminal ? { terminal } : {}; },
};
const result = await runScenario(input, driver, { store: new MemoryEffectStore() });
```

The driver field names a built-in example for the CLI; the API executes the explicitly
provided AgentDriver. Use entry instead for a custom compiled JS module in CLI scenarios.
A driver factory exports createDriver(), returning a fresh driver for each run.

## Contracts
AgentDriver: start(ctx), requestCancel(reason), optional resume(receipt, ctx), observe().
observe returns terminal completed/canceled/failed when physically observed; an empty
object is incomplete evidence. A resolved start promise alone is insufficient.
requestCancel is intent; the driver records actual observation and acknowledgement
through ctx.observeCancel() and ctx.acknowledgeCancel().

ScenarioContext:
- signal and seed: cooperative AbortSignal and reproducibility seed.
- step(operation, work): emits before-step, step_started, after-step-start, then completion.
- barrier(site, operation): exposes one of the four exact configured sites.
- checkpoint(receipt): records an application-defined bounded receipt and effect IDs.
- recordEffect({operation, logicalOperationId, idempotencyKey, idempotent?}): records a call,
  enters before-effect-commit, commits synchronously through the store, records a physical
  commit only for a new row, then enters after-effect-commit-before-response.
- requestCancel(), observeCancel(), acknowledgeCancel(): distinct lifecycle evidence.
- observeState(): physical fixture snapshot or undefined.

Top-level step/checkpoint/requestCancel/recordEffect/observeState helpers delegate to ctx.
CancellationError and native AbortError are treated as cooperative cancellation only
after a cancel request. Other executable exceptions are HARNESS_ERROR; raw exception
messages/stacks are suppressed. Completion after a cancel request can legitimately PASS.

Resume receives a fresh AbortSignal and context. Previous contexts are revoked; they
cannot write into the resumed attempt. The checkpoint receipt is an application contract,
not a universal framework checkpoint implementation. The stable logical key, not a new
physical effect ID, deduplicates a resumed effect.

## Store/oracle
EffectStore.commit returns {effect, created}; snapshot returns physical rows or undefined;
callCount counts attempted commits even for deduplicated calls. SQLiteEffectStore(path)
requires a new path in an isolated private directory. Close before deleting that directory.
The CLI creates and cleans it automatically. Default API store is in-memory.
Snapshots outrank ledger narration; snapshot/commit event mismatches are HARNESS_ERROR.
The caller owns custom stores and must supply trusted, coherent physical observations.
No caller-defined payload is serialized. Identifiers are bounded and validated.

## Time and classification
Defaults: run timeout 2000 ms, step timeout 1000 ms, cancel grace 500 ms.
All configured deadlines are 1–60000 ms. Timing bounds are watchdogs, not race scheduling.
The selected operation/occurrence triggers cancellation exactly once across start/resume.
Missing selected boundary or terminal is INCONCLUSIVE. Timed-out contexts are revoked.
CLI child isolation also bounds synchronous loops and handle leaks; the in-process API
cannot stop synchronous JavaScript or promises/side effects outside instrumentation.

Outcome precedence is HARNESS_ERROR > FAIL > INCONCLUSIVE > PASS. All rule outcomes
remain visible. PASS requires every required invariant to be observed and satisfied.
A known violated invariant remains FAIL even if another observation is missing.

## Recorder and privacy
Events have schemaVersion 1, deterministic sequence, runId/scenarioId, relativeMs and
bounded reference fields only. sequence defines order; relativeMs is diagnostic.
createRecorder(runId, scenarioId, newJsonlPath?, redactPaths?) optionally writes
append-only JSONL and refuses an existing sink. Snapshot copies protect recorder state.
Default credential-shape/key redaction and explicit metadata paths apply to returned
results and JSONL. Reports must still be inspected before sharing.
See CLI reference for limits and schema. Security-sensitive behavior is tested in
tests/runner.test.ts and tests/cli.test.ts.
