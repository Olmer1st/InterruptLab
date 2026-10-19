import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRecorder } from '@interruptlab/core';
import { InvoiceStore } from '../../packages/fixtures/src/index.js';
import { runBuggy } from '../../examples/invoice-resume/buggy/index.js';
import { runFixed } from '../../examples/invoice-resume/fixed/index.js';
const directories: string[] = [];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'interruptlab-test-'));
  directories.push(dir);
  return join(dir, 'invoices.jsonl');
}
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true }); });
test('public core entrypoint preserves event order and protects snapshots', () => {
  const recorder = createRecorder('run', 'scenario');
  recorder.record('step_started');
  recorder.record('step_completed');
  const snapshot = recorder.snapshot();
  expect(snapshot.map(event => event.sequence)).toEqual([1, 2]);
  snapshot[0]!.sequence = 99;
  expect(recorder.snapshot()[0]!.sequence).toBe(1);
});
for (let iteration = 1; iteration <= 5; iteration++) {
  test('persisted buggy/fixed control pair ' + iteration, () => {
    const buggy = runBuggy(fixture());
    const fixed = runFixed(fixture());
    expect(buggy.classification).toBe('FAIL');
    expect(buggy.invoices.map(row => row.effectId)).toEqual(['inv-1', 'inv-2']);
    expect(fixed.classification).toBe('PASS');
    expect(fixed.invoices).toEqual([{ effectId: 'inv-1', logicalOperationId: 'demo-42' }]);
    expect(buggy.invoices.every(row => row.logicalOperationId === 'demo-42')).toBe(true);
  });
}
test('invalid keys and corrupt persisted state fail instead of reporting a pass', () => {
  const path = fixture();
  const store = new InvoiceStore(path);
  expect(() => store.createInvoice('../unsafe', false)).toThrow('Invalid operation key');
  writeFileSync(path, '{"effectId":1}\n');
  expect(() => store.snapshot()).toThrow('Invalid fixture row');
});
