import { afterEach, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { demoScenarios } from '../packages/cli/src/demo.js';
import { redact, render, resultSchema } from '../packages/reporter/src/index.js';
import { harnessError } from '../packages/core/src/runner.js';
const cli = resolve('dist/runtime/cli.js');
const directories: string[] = [];
function directory() { const dir = mkdtempSync(join(tmpdir(), 'interruptlab-cli-')); directories.push(dir); return dir; }
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function run(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
}
function scenarioFile(cwd: string, driver: string, name = 'case.json') {
  const scenario = demoScenarios().find(item => item.driver === driver)!;
  writeFileSync(join(cwd, name), JSON.stringify(scenario));
  return name;
}
test('built CLI exit codes 0/1/2/3 and default INCONCLUSIVE warning', () => {
  const dir = directory();
  expect(run(dir, 'run', scenarioFile(dir, 'invoice-fixed')).status).toBe(0);
  expect(run(dir, 'run', scenarioFile(dir, 'invoice-buggy')).status).toBe(1);
  expect(run(dir, 'run', scenarioFile(dir, 'driver-error')).status).toBe(2);
  expect(run(dir, 'run', scenarioFile(dir, 'missing-observer'), '--fail-on-inconclusive').status).toBe(3);
  const inconclusive = run(dir, 'run', 'case.json');
  expect(inconclusive.status).toBe(0);
  expect(inconclusive.stdout).toContain('WARNING: incomplete evidence');
  const jsonOnly = run(dir, 'run', 'case.json', '--format', 'json');
  expect(jsonOnly.status).toBe(0);
  expect(jsonOnly.stderr).toContain('WARNING: INCONCLUSIVE');
});
test('demo validates all eight controls and writes parseable canonical/JUnit/Markdown artifacts', () => {
  const dir = directory();
  const result = run(dir, 'demo', '--out', 'reports', '--format', 'terminal,json,junit,markdown');
  expect(result.status, result.stderr).toBe(0);
  const report = JSON.parse(readFileSync(join(dir, 'reports/run.json'), 'utf8'));
  expect(report.results).toHaveLength(8);
  for (const item of report.results) expect(resultSchema.safeParse(item).success).toBe(true);
  const xml = readFileSync(join(dir, 'reports/junit.xml'), 'utf8');
  expect(XMLValidator.validate(xml)).toBe(true);
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml).testsuite;
  expect(parsed['@_tests']).toBe('8');
  expect(parsed['@_failures']).toBe('2');
  expect(parsed['@_errors']).toBe('1');
  expect(parsed['@_skipped']).toBe('2');
  expect(readFileSync(join(dir, 'reports/report.md'), 'utf8')).toContain('INCONCLUSIVE');
  expect(readFileSync(join(dir, 'reports/events.jsonl'), 'utf8').trim().split('\n').every(line => JSON.parse(line).sequence > 0)).toBe(true);
  expect(run(dir, 'demo', '--out', 'reports').status).toBe(2);
  expect(run(dir, 'report', 'reports/run.json', '--format', 'markdown').status).toBe(2); // retains harness/error outcome
});
test('init creates an independently executable driver and never overwrites files', () => {
  const dir = directory();
  expect(run(dir, 'init', 'sample').status).toBe(0);
  expect(run(dir, 'init', 'sample').status).toBe(2);
  expect(run(dir, 'run', 'sample/scenario.json').status).toBe(0);
  expect(run(dir, '--help').stdout).toContain('Trusted JS drivers');
  expect(run(dir, '--version').stdout.trim()).toBe('0.1.0');
});
test('malformed YAML, duplicate IDs, unknown keys, unsafe entries and invalid seeds fail before execution', () => {
  const dir = directory();
  writeFileSync(join(dir, 'bad.yaml'), 'schemaVersion: [\n');
  expect(run(dir, 'run', 'bad.yaml').status).toBe(2);
  writeFileSync(join(dir, 'bad.yaml'), 'schemaVersion: 1\nschemaVersion: 1\n');
  expect(run(dir, 'run', 'bad.yaml').status).toBe(2);
  mkdirSync(join(dir, 'scenarios'));
  scenarioFile(join(dir, 'scenarios'), 'invoice-fixed', 'a.json');
  scenarioFile(join(dir, 'scenarios'), 'invoice-fixed', 'b.json');
  expect(run(dir, 'run', 'scenarios').status).toBe(2);
  const input = demoScenarios()[1]!;
  writeFileSync(join(dir, 'unknown.json'), JSON.stringify({ ...input, unknownKey: true }));
  expect(run(dir, 'run', 'unknown.json').status).toBe(2);
  expect(run(dir, 'run', scenarioFile(dir, 'invoice-fixed'), '--seed', '-1').status).toBe(2);
  expect(run(dir, 'run', 'case.json', '--seed', '9999999999').status).toBe(2);
  const outside = directory();
  writeFileSync(join(outside, 'evil.mjs'), 'throw new Error("must not execute")');
  symlinkSync(join(outside, 'evil.mjs'), join(dir, 'evil.mjs'));
  writeFileSync(join(dir, 'escape.json'), JSON.stringify({ ...input, driver: undefined, entry: './evil.mjs' }));
  expect(run(dir, 'run', 'escape.json').status).toBe(2);
  writeFileSync(join(dir, 'oversized.json'), ' '.repeat(65537));
  expect(run(dir, 'run', 'oversized.json').status).toBe(2);
});
test('watchdog bounds a synchronously stuck driver and leaked handles do not keep CLI alive', () => {
  const dir = directory();
  const input = demoScenarios()[1]!;
  writeFileSync(join(dir, 'hang.mjs'), 'export function createDriver() { while(true) {} }');
  writeFileSync(join(dir, 'hang.json'), JSON.stringify({ ...input, driver: undefined, entry: './hang.mjs', timeoutMs: 20 }));
  const hung = run(dir, 'run', 'hang.json', '--fail-on-inconclusive');
  expect(hung.status).toBe(3);
  expect(hung.stdout).toContain('watchdog');
  expect(readdirSync(join(dir, '.interruptlab/results'))).toHaveLength(1);
  writeFileSync(join(dir, 'leak.mjs'), `export function createDriver() {
    setInterval(() => {}, 1000);
    return {async start() {}, async requestCancel() {}, async observe() {return {terminal:'completed'}}};
  }`);
  writeFileSync(join(dir, 'leak.json'), JSON.stringify({ schemaVersion: 1, id: 'handles', entry: './leak.mjs',
    assertions: [{ type: 'observed_terminal_state', anyOf: ['completed'] }] }));
  expect(run(dir, 'run', 'leak.json').status).toBe(0);
});
test('invalid imported reports cannot silently manufacture a PASS', () => {
  const dir = directory();
  const result = { ...harnessError(), classification: 'PASS' };
  writeFileSync(join(dir, 'fake.json'), JSON.stringify({ schemaVersion: 1, results: [result] }));
  expect(run(dir, 'report', 'fake.json').status).toBe(2);
});
test('redaction covers nested sensitive fields, credential shapes and configured metadata paths', () => {
  const value = { password: 'SYNTHETIC_VALUE', nested: { api_key: 'SYNTHETIC_VALUE' },
    note: 'Bearer SYNTHETIC_BEARER', effects: [{ idempotencyKey: 'private-demo' }] };
  const safe = redact(value, ['effects.0.idempotencyKey']);
  expect(JSON.stringify(safe)).not.toContain('SYNTHETIC');
  expect(safe.effects[0]!.idempotencyKey).toBe('[REDACTED]');
  expect(value.effects[0]!.idempotencyKey).toBe('private-demo');
});
test('XML escapes malicious labels and invalid control bytes without invalid markup', () => {
  const result = harnessError('sample');
  result.scenarioId = '<script>&"';
  result.rules[0]!.message = 'bad\u0001 <tag>';
  const xml = render([result], 'junit');
  expect(XMLValidator.validate(xml)).toBe(true);
  expect(xml).not.toContain('<script>');
});

test('committed scenario packs match the demo controls', () => {
  for (const scenario of demoScenarios()) {
    expect(JSON.parse(readFileSync(resolve('scenarios/' + scenario.driver + '.json'), 'utf8'))).toEqual(scenario);
  }
});

test('raw invalid report content and driver console output are suppressed', () => {
  const dir = directory();
  writeFileSync(join(dir, 'secret.json'), 'SYNTHETIC_PRIVATE_REPORT_CONTENT');
  const broken = run(dir, 'report', 'secret.json');
  expect(broken.status).toBe(2);
  expect(broken.stderr).not.toContain('SYNTHETIC_PRIVATE_REPORT_CONTENT');
  writeFileSync(join(dir, 'noisy.mjs'), `export function createDriver() {
    console.log('SYNTHETIC_PRIVATE_CONSOLE');
    return {async start() {throw new Error('SYNTHETIC_PRIVATE_ERROR')},
      async requestCancel() {},async observe(){return {}}};
  }`);
  writeFileSync(join(dir, 'noisy.json'), JSON.stringify({ schemaVersion:1,id:'noisy',entry:'./noisy.mjs',
    assertions:[{type:'observed_terminal_state',anyOf:['completed']}] }));
  const noisy = run(dir, 'run', 'noisy.json');
  expect(noisy.status).toBe(2);
  expect(noisy.stdout + noisy.stderr).not.toContain('SYNTHETIC_PRIVATE');
});

test('native AbortError from a custom ESM driver is accepted only after cancellation', () => {
  const dir = directory();
  writeFileSync(join(dir, 'abort.mjs'), `export function createDriver() {
    let ctx; let state;
    return {
      async start(context) { ctx=context;
        await ctx.step('read', async () => {
          try {ctx.signal.throwIfAborted()} catch(error) {state='canceled';throw error}
        });
      },
      async requestCancel() {ctx.observeCancel();ctx.acknowledgeCancel()},
      async observe() {return state?{terminal:state}:{}}
    };
  }`);
  writeFileSync(join(dir, 'abort.json'), JSON.stringify({schemaVersion:1,id:'native-abort',entry:'./abort.mjs',
    cancel:{at:'after-step-start',operation:'read'},
    assertions:[{type:'cancel_propagated'},{type:'observed_terminal_state',anyOf:['canceled']}]}));
  expect(run(dir, 'run', 'abort.json').status).toBe(0);
});
