import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runScenario, CancellationError } from '../packages/core/src/runner.js';
import { scenarioSchema, boundaries } from '../packages/core/src/schema.js';
import { MemoryEffectStore } from '../packages/core/src/store.js';
import { createRecorder } from '../packages/core/src/recorder.js';
import { SQLiteEffectStore } from '../packages/fixtures/src/sqlite.js';
import { createBuiltinDriver } from '../packages/driver-node/src/index.js';
import { demoScenarios } from '../packages/cli/src/demo.js';
import type { AgentDriver, ScenarioContext } from '../packages/core/src/types.js';
const directories: string[] = [];
function directory() { const dir = mkdtempSync(join(tmpdir(), 'interruptlab-runner-')); directories.push(dir); return dir; }
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const terminal = { type: 'observed_terminal_state', anyOf: ['completed', 'canceled'] };
function fixtureDriver(work: (ctx: ScenarioContext) => Promise<void>, observe = true): AgentDriver {
  let context: ScenarioContext;
  let state: 'completed' | 'canceled' | undefined;
  return {
    async start(ctx) {
      context = ctx;
      try { await work(ctx); state = 'completed'; }
      catch (error) { if (error instanceof CancellationError) { state = 'canceled'; throw error; } throw error; }
    },
    async requestCancel() { context.observeCancel(); context.acknowledgeCancel(); },
    async observe() { return observe && state ? { terminal: state } : {}; },
  };
}
test('50 deterministic executions cover all four boundaries, selected occurrence and single injection', async () => {
  for (let i = 0; i < 50; i++) {
    const at = boundaries[i % boundaries.length]!;
    const driver = fixtureDriver(async ctx => {
      for (let j = 0; j < 2; j++) await ctx.step('write', async () => {
        await ctx.recordEffect({ operation: 'write', logicalOperationId: 'op-' + j, idempotencyKey: 'key-' + j });
      });
    });
    const result = await runScenario({ schemaVersion: 1, id: 'boundary/case', driver: 'invoice-fixed',
      cancel: { at, operation: 'write', occurrence: 2 }, assertions: [terminal, { type: 'cancel_propagated' }] }, driver);
    expect(result.classification).toBe('PASS');
    expect(result.boundaryReached).toBe(true);
    expect(result.events.filter(event => event.kind === 'cancel_requested')).toHaveLength(1);
    expect(result.events.map(event => event.sequence)).toEqual(result.events.map((_, n) => n + 1));
    const selected = result.events.filter(event => event.kind === 'barrier_reached' &&
      event.stepId === at && event.logicalOperationId === 'write');
    expect(selected).toHaveLength(2);
    expect(result.events.find(event => event.kind === 'cancel_requested')!.sequence).toBe(selected[1]!.sequence + 1);
  }
});
test('cancel before first step is cooperative and produces no writes', async () => {
  const driver = fixtureDriver(async ctx => {
    await ctx.step('write', async () => {
      if (ctx.signal.aborted) throw new CancellationError();
      await ctx.recordEffect({ operation: 'write', logicalOperationId: 'one', idempotencyKey: 'one' });
    });
  });
  const result = await runScenario({ schemaVersion: 1, id: 'before', driver: 'invoice-fixed',
    cancel: { at: 'before-step', operation: 'write' },
    assertions: [terminal, { type: 'cancel_propagated' }] }, driver);
  expect(result.classification).toBe('PASS');
  expect(result.effects).toEqual([]);
  expect(result.terminal).toBe('canceled');
});
test('missing boundary, missing terminal and malformed config cannot pass', async () => {
  const input = { schemaVersion: 1, id: 'missing', driver: 'invoice-fixed', assertions: [terminal],
    cancel: { at: 'before-step', operation: 'never' } };
  expect((await runScenario(input, fixtureDriver(async () => {}))).classification).toBe('INCONCLUSIVE');
  expect((await runScenario({ ...input, cancel: undefined }, fixtureDriver(async () => {}, false))).classification).toBe('INCONCLUSIVE');
  expect((await runScenario({ ...input, timeoutMs: 0 }, fixtureDriver(async () => {}))).classification).toBe('HARNESS_ERROR');
});
test('request alone and even observed acknowledgement are not proof of stop', async () => {
  const scenario = demoScenarios().find(item => item.driver === 'noncooperative')!;
  const result = await runScenario(scenario, createBuiltinDriver('noncooperative'));
  expect(result.classification).toBe('INCONCLUSIVE');
  expect(result.events.map(event => event.kind)).not.toContain('execution_terminated');
});
test('per-step and global deadlines revoke late writes and return boundedly', async () => {
  let captured: ScenarioContext | undefined;
  const driver = fixtureDriver(async ctx => { captured = ctx; await ctx.step('stuck', () => new Promise(() => {})); });
  const result = await runScenario({ schemaVersion: 1, id: 'stuck', driver: 'noncooperative',
    timeoutMs: 50, stepTimeoutMs: 10, assertions: [terminal] }, driver);
  expect(result.classification).toBe('INCONCLUSIVE');
  await expect(captured!.recordEffect({ operation: 'late', logicalOperationId: 'late', idempotencyKey: 'late' })).rejects.toThrow('revoked');
});
test('driver errors never leak arbitrary exception messages', async () => {
  const result = await runScenario({ schemaVersion: 1, id: 'error', driver: 'driver-error', assertions: [terminal] },
    fixtureDriver(async () => { throw new Error('sk-SYNTHETIC_TEST_TOKEN'); }));
  expect(result.classification).toBe('HARNESS_ERROR');
  expect(JSON.stringify(result)).not.toContain('SYNTHETIC_TEST_TOKEN');
});
test('all eight packs reproduce ten times with SQLite physical state', async () => {
  const expected = ['FAIL', 'PASS', 'PASS', 'INCONCLUSIVE', 'INCONCLUSIVE', 'HARNESS_ERROR', 'FAIL', 'PASS'];
  for (let iteration = 0; iteration < 10; iteration++) {
    for (const [index, scenario] of demoScenarios().entries()) {
      const path = join(directory(), 'fixture.sqlite');
      const store = new SQLiteEffectStore(path, scenario.driver !== 'missing-observer');
      const result = await runScenario(scenario, createBuiltinDriver(scenario.driver!), { store });
      expect(result.classification).toBe(expected[index]);
      if (scenario.driver === 'invoice-buggy' || scenario.driver === 'invoice-fixed') {
        const count = scenario.driver === 'invoice-buggy' ? 2 : 1;
        expect(store.snapshot()).toHaveLength(count);
        expect(store.snapshot()!.every(row => row.committed === true)).toBe(true);
        expect(store.callCount()).toBe(2);
        store.close();
        const database = new DatabaseSync(path, { readOnly: true });
        expect(database.prepare('SELECT COUNT(*) AS n FROM effects').get()!.n).toBe(count);
        database.close();
      } else store.close();
    }
  }
});
test('oracle mismatch is HARNESS_ERROR even if effect_count alone is satisfied', async () => {
  class Mismatch extends MemoryEffectStore {
    override snapshot() { return super.snapshot()!.map(row => ({ ...row, sequence: 999 })); }
  }
  const scenario = demoScenarios()[1]!;
  const result = await runScenario(scenario, createBuiltinDriver('invoice-fixed'), { store: new Mismatch() });
  expect(result.classification).toBe('HARNESS_ERROR');
});
test('late commits fail only with an explicit forbidden barrier contract', async () => {
  const input = demoScenarios().find(s => s.driver === 'late-commit')!;
  expect((await runScenario(input, createBuiltinDriver('late-commit'))).classification).toBe('FAIL');
  expect((await runScenario({ ...input, assertions: [terminal] }, createBuiltinDriver('late-commit'))).classification).toBe('PASS');
});
test('missing physical observer cannot pass even when terminal is completed', async () => {
  const result = await runScenario(demoScenarios()[1]!, createBuiltinDriver('invoice-fixed'), { store: new MemoryEffectStore(false) });
  expect(result.classification).toBe('INCONCLUSIVE');
});
test('fresh SQLite lifecycle refuses existing paths and rolls back invalid effects', () => {
  const path = join(directory(), 'fixture.sqlite');
  const store = new SQLiteEffectStore(path);
  expect(() => new SQLiteEffectStore(path)).toThrow('already exists');
  expect(() => store.commit({ operation: 'unsafe space', logicalOperationId: 'one', idempotencyKey: 'one' }, 1, 'run')).toThrow();
  expect(store.callCount()).toBe(0);
  expect(store.snapshot()).toEqual([]);
  store.close();
  expect(() => store.snapshot()).toThrow('closed');
});
test('JSONL event ledger contains bounded metadata and immutable sequence', () => {
  const path = join(directory(), 'events.jsonl');
  const record = createRecorder('run', 'case', path);
  record.record('step_started', { stepId: 'safe' });
  record.record('step_completed');
  expect(readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line).sequence)).toEqual([1, 2]);
  expect(() => createRecorder('run', 'case', path)).toThrow();
  expect(() => record.record('unknown' as never)).toThrow('Unsupported event kind');
  expect(() => record.record('step_started', { stepId: 'raw payload!' })).toThrow();
});
test('schema rejects unsupported boundary, zero occurrence, unknown keys and empty assertions', () => {
  const input = demoScenarios()[0]!;
  for (const change of [{ cancel: { at: 'unknown', operation: 'write' } }, { timeoutMs: -1 },
    { cancel: { at: 'before-step', operation: 'write', occurrence: 0 } }, { assertions: [] }, { surprise: true }]) {
    expect(scenarioSchema.safeParse({ ...input, ...change }).success).toBe(false);
  }
});

test('resume gets a fresh signal and revokes the previous execution context', async () => {
  let old: ScenarioContext;
  let state: 'completed' | 'canceled' = 'completed';
  const driver: AgentDriver = {
    async start(ctx) {
      old = ctx; ctx.checkpoint('receipt');
      await ctx.step('pause', async () => { if (ctx.signal.aborted) { state = 'canceled'; throw new CancellationError(); } });
    },
    async requestCancel() { old.observeCancel(); old.acknowledgeCancel(); },
    async resume(receipt, ctx) {
      expect(receipt).toBe('receipt');
      expect(ctx.signal.aborted).toBe(false);
      expect(old.signal.aborted).toBe(true);
      await expect(old.recordEffect({ operation: 'stale', logicalOperationId: 'old', idempotencyKey: 'old' })).rejects.toThrow('revoked');
      state = 'completed';
    },
    async observe() { return { terminal: state }; },
  };
  const result = await runScenario({ schemaVersion: 1, id: 'fresh-resume', driver: 'invoice-fixed',
    cancel: { at: 'after-step-start', operation: 'pause' }, resume: { enabled: true }, assertions: [terminal] }, driver);
  expect(result.classification).toBe('PASS');
});

test('configured metadata redaction applies to the optional JSONL sink', () => {
  const path = join(directory(), 'private-events.jsonl');
  const record = createRecorder('run', 'case', path, ['events.0.logicalOperationId']);
  record.record('effect_started', { logicalOperationId: 'sensitive-demo' });
  expect(readFileSync(path, 'utf8')).not.toContain('sensitive-demo');
  expect(readFileSync(path, 'utf8')).toContain('[REDACTED]');
});

test('corrupted SQLite observation fails closed instead of producing a green count', async () => {
  const path = join(directory(), 'damaged.sqlite');
  const store = new SQLiteEffectStore(path);
  const driver = fixtureDriver(async ctx => {
    await ctx.recordEffect({operation:'write', logicalOperationId:'one', idempotencyKey:'one'});
    const outside = new DatabaseSync(path);
    outside.exec('DROP TABLE effects');
    outside.close();
  });
  const result = await runScenario({schemaVersion:1,id:'damaged-oracle',driver:'invoice-fixed',
    assertions:[{type:'effect_count',operation:'write',groupBy:'idempotencyKey',key:'one',exactly:1},terminal]}, driver, {store});
  expect(result.classification).toBe('HARNESS_ERROR');
  store.close();
});
