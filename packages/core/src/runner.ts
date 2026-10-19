import { redact } from './privacy.js';
import { createHash } from 'node:crypto';
import { scenarioSchema, identifier, boundaries } from './schema.js';
import { createRecorder } from './recorder.js';
import { MemoryEffectStore, validateEffect } from './store.js';
import { classify, evaluateAssertions } from './assertions.js';
import type { AgentDriver, EffectStore, RunResult, ScenarioContext } from './types.js';
/** Raised only when the cooperative driver explicitly observes cancellation. */
export class CancellationError extends Error { override name = 'CancellationError'; }
class DeadlineError extends Error {}
/** Bound asynchronous work; timers are cleared on both fulfillment and failure. */
async function bounded<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new DeadlineError()), Math.max(1, milliseconds));
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
/** Default error artifact; errors never persist arbitrary driver messages or stacks. */
export function harnessError(scenarioId = 'invalid', seed = 42, message = 'Invalid configuration or driver'): RunResult {
  return { schemaVersion: 1, scenarioId, seed, runId: 'run-' + seed, classification: 'HARNESS_ERROR',
    rules: [{ rule: 'harness', classification: 'HARNESS_ERROR', message, eventSequences: [] }],
    events: [], initialFixtureHash: '', effects: null, callCount: 0, terminal: null, boundaryReached: false,
    checkpoint: null, environment: { node: process.version, platform: process.platform, version: '0.1.0' },
    reproduction: 'interruptlab run <scenario>', limitations: ['Trusted cooperative code only'] };
}
/** Run one instrumented driver. CLI isolation also bounds synchronous or handle-leaking drivers. */
export async function runScenario(input: unknown, driver: AgentDriver,
  options: { store?: EffectStore; jsonlPath?: string } = {}): Promise<RunResult> {
  const parsed = scenarioSchema.safeParse(input);
  if (!parsed.success) return harnessError();
  const scenario = parsed.data;
  const failure = harnessError(scenario.id, scenario.seed);
  if (!driver || typeof driver.start !== 'function' || typeof driver.requestCancel !== 'function' ||
      typeof driver.observe !== 'function' || (scenario.resume.enabled && typeof driver.resume !== 'function')) return failure;
  const store = options.store ?? new MemoryEffectStore();
  const runId = 'run-' + scenario.seed;
  let controller = new AbortController();
  let generation = 0;
  let active = true;
  let reached = false;
  let occurrence = 0;
  let canceledAt: number | undefined;
  let cancelTimer: ReturnType<typeof setTimeout> | undefined;
  let rejectCancel: (reason: Error) => void = () => {};
  const cancellationDeadline = new Promise<never>((_, reject) => { rejectCancel = reject; });
  // Attach a handler even if cancellation is requested from a later observer.
  void cancellationDeadline.catch(() => {});
  let receipt: string | undefined;
  let checkpointEffects: string[] | undefined;
  let resumed = false;
  const started = performance.now();
  const remaining = () => Math.min(scenario.timeoutMs - (performance.now() - started),
    canceledAt === undefined ? scenario.timeoutMs : (scenario.cancel?.graceMs ?? 500) - (performance.now() - canceledAt));
  let record: ReturnType<typeof createRecorder>;
  try { record = createRecorder(runId, scenario.id, options.jsonlPath, scenario.redact); }
  catch { return failure; }
  const guard = () => { if (!active) throw new Error('Run context revoked'); };
  const requestCancel = async () => {
    guard();
    if (controller.signal.aborted) return;
    record.record('cancel_requested');
    canceledAt = performance.now();
    controller.abort();
    cancelTimer = setTimeout(() => rejectCancel(new DeadlineError()), scenario.cancel?.graceMs ?? 500);
    await bounded(Promise.resolve().then(() => driver.requestCancel('scenario-cancel')), Math.max(1, remaining()));
  };
  function createContext(): ScenarioContext {
    const expectedGeneration = generation;
    const guard = () => { if (!active || generation !== expectedGeneration) throw new Error('Run context revoked'); };
    const phaseStart = record.nextSequence();
    const ctx: ScenarioContext = {
    signal: controller.signal, seed: scenario.seed,
    async requestCancel() { guard(); await requestCancel(); },
    async barrier(site, operation) {
      guard(); identifier.parse(operation);
      if (!boundaries.includes(site)) throw new Error('Unsupported boundary');
      record.record('barrier_reached', { stepId: site, logicalOperationId: operation });
      if (!scenario.cancel || reached || scenario.cancel.at !== site || scenario.cancel.operation !== operation) return;
      occurrence++;
      if (occurrence === scenario.cancel.occurrence) { reached = true; await requestCancel(); }
    },
    async step(operation, work) {
      guard(); identifier.parse(operation);
      await ctx.barrier('before-step', operation);
      record.record('step_started', { stepId: operation });
      await ctx.barrier('after-step-start', operation);
      const result = await bounded(Promise.resolve().then(work), Math.min(scenario.stepTimeoutMs, remaining()));
      guard();
      record.record('step_completed', { stepId: operation });
      return result;
    },
    checkpoint(value) {
      guard(); identifier.parse(value);
      receipt = value;
      checkpointEffects = store.snapshot()?.map(row => row.effectId);
      record.record('checkpoint_saved', { stepId: value });
    },
    observeCancel() {
      guard();
      if (!controller.signal.aborted) throw new Error('Cancellation not requested');
      if (!record.snapshot().some(event => event.kind === 'cancel_observed' && event.sequence >= phaseStart)) record.record('cancel_observed');
    },
    acknowledgeCancel() {
      guard();
      if (!record.snapshot().some(event => event.kind === 'cancel_observed' && event.sequence >= phaseStart)) throw new Error('Cancellation not observed');
      if (!record.snapshot().some(event => event.kind === 'cancel_acknowledged' && event.sequence >= phaseStart)) record.record('cancel_acknowledged');
    },
    async recordEffect(effect) {
      guard(); validateEffect(effect);
      record.record('effect_started', { logicalOperationId: effect.logicalOperationId });
      await ctx.barrier('before-effect-commit', effect.operation);
      guard();
      let committed;
      try { committed = store.commit(effect, record.nextSequence(), runId); }
      catch {
        record.record('effect_failed', { logicalOperationId: effect.logicalOperationId });
        throw new Error('Fixture commit failed');
      }
      if (committed.created) record.record('effect_committed', { effectId: committed.effect.effectId,
        logicalOperationId: effect.logicalOperationId });
      await ctx.barrier('after-effect-commit-before-response', effect.operation);
      return committed.effect;
    },
    observeState() { guard(); return store.snapshot(); },
    };
    return ctx;
  }
  let ctx = createContext();
  let initialHash = '';
  let issue: 'timeout' | 'error' | undefined;
  let terminal: 'completed' | 'canceled' | 'failed' | undefined;
  try {
    const initial = store.snapshot();
    if (initial && initial.length !== 0) throw new Error('Fixture must start empty');
    initialHash = createHash('sha256').update(JSON.stringify(initial ?? null)).digest('hex');
    try {
      await bounded(Promise.race([Promise.resolve().then(() => driver.start(ctx)), cancellationDeadline]), scenario.timeoutMs);
    } catch (error) {
      const cooperativeAbort = controller.signal.aborted && error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'CancellationError');
      if (!cooperativeAbort) throw error;
    }
    if (scenario.resume.enabled) {
      if (!receipt) throw new Error('Missing resume receipt');
      record.record('resume_started', { stepId: receipt });
      resumed = true;
      // Resume is a new execution attempt; old contexts cannot write into it.
      generation++;
      if (cancelTimer) clearTimeout(cancelTimer);
      canceledAt = undefined;
      controller = new AbortController();
      ctx = createContext();
      // Reaching cancellation once does not inject it again during resume.
      await bounded(Promise.resolve().then(() => driver.resume!(receipt!, ctx)), remaining());
    }
  } catch (error) {
    issue = error instanceof DeadlineError ? 'timeout' : 'error';
  }
  // A timeout revokes writes immediately; pending user promises cannot alter fixture state later.
  if (issue === 'timeout') { active = false; controller.abort(); }
  try {
    const observation = await bounded(Promise.resolve().then(() => driver.observe()), Math.max(1, remaining()));
    if (observation && ['completed', 'canceled', 'failed'].includes(observation.terminal ?? '')) terminal = observation.terminal;
  } catch { /* Absence is explicit evidence, never an invented terminal state. */ }
  try {
    if (terminal) record.record('execution_terminated', { stepId: terminal });
    else record.record('observation_missing');
  } catch { issue = 'error'; }
  if (cancelTimer) clearTimeout(cancelTimer);
  active = false;
  let effects;
  let calls = 0;
  try { effects = store.snapshot(); calls = store.callCount(); }
  catch { issue = 'error'; }
  const events = record.snapshot();
  const rules = evaluateAssertions(scenario.assertions, { events, effects, terminal, checkpointEffects, resumed, receipt });
  const add = (classification: 'HARNESS_ERROR' | 'INCONCLUSIVE', rule: string, message: string) =>
    rules.push({ rule, classification, message, eventSequences: [] });
  if (issue === 'error') add('HARNESS_ERROR', 'driver', 'Driver or fixture execution failed; raw errors are suppressed');
  if (issue === 'timeout') add('INCONCLUSIVE', 'deadline', 'Execution deadline exceeded; context revoked');
  if (scenario.cancel && !reached) add('INCONCLUSIVE', 'boundary', 'Selected boundary occurrence was not reached');
  if (!terminal) add('INCONCLUSIVE', 'terminal', 'No terminal state was observed');
  if (effects) {
    const commits = events.filter(event => event.kind === 'effect_committed');
    const bySequence = new Map(commits.map(event => [event.sequence, event]));
    const consistent = commits.length === effects.length && new Set(effects.map(row => row.effectId)).size === effects.length &&
      effects.every(row => {
        const event = bySequence.get(row.sequence);
        return row.runId === runId && event?.effectId === row.effectId && event.logicalOperationId === row.logicalOperationId;
      });
    if (!consistent) add('HARNESS_ERROR', 'oracle_consistency', 'Physical state and event ledger disagree');
  }
  return redact({ ...failure, classification: classify(rules.map(rule => rule.classification)), rules, events,
    initialFixtureHash: initialHash, effects: effects ?? null, callCount: calls, terminal: terminal ?? null,
    boundaryReached: reached, checkpoint: receipt ?? null,
    reproduction: 'interruptlab run <scenario> --seed ' + scenario.seed,
    limitations: ['Cooperative instrumentation only; abort does not roll back committed effects',
      'In-process API cannot interrupt synchronous JavaScript; CLI uses process isolation'] }, scenario.redact);
}
