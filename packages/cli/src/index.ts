#!/usr/bin/env node
import { mkdirSync, writeFileSync, renameSync, existsSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { scenarioSchema } from '../../core/src/schema.js';
import { ConfigurationError, loadScenarios, resolveEntry, readBounded } from './loader.js';
import { demoScenarios } from './demo.js';
import { runIsolated } from './isolate.js';
import { exitCode, redact, render, resultSchema } from '../../reporter/src/index.js';
import type { RunResult } from '../../core/src/types.js';
const help = `InterruptLab 0.1.0 — trusted local TypeScript workflow regression harness
Usage:
  interruptlab init [directory]
  interruptlab run <file|directory> [--seed N] [--format terminal,json,junit,markdown]
                   [--out NEW_DIRECTORY] [--fail-on-inconclusive]
  interruptlab demo [--out NEW_DIRECTORY] [--format terminal,json,junit,markdown]
  interruptlab report <run.json> [--format terminal|json|junit|markdown] [--out NEW_DIRECTORY]
  interruptlab --help
Exit: 0 no failures (inconclusive warns); 1 violated invariant; 2 harness/config; 3
inconclusive with --fail-on-inconclusive. Precedence: 2 > 1 > 3 > 0.
Demo includes intentional FAIL/HARNESS_ERROR/INCONCLUSIVE cases and exits 0 only
when their expected classifications match. It is a self-check, not a green test suite.
Trusted JS drivers only: no sandbox security guarantee, remote rollback, or model scoring.
Outputs must use a NEW directory; existing results are never overwritten.`;
const formats = z.array(z.enum(['terminal', 'json', 'junit', 'markdown'])).min(1).max(4);
function writeReports(directory: string, results: RunResult[], requested: z.infer<typeof formats>) {
  if (Buffer.byteLength(render(results, 'json')) > 16 * 1024 * 1024) throw new ConfigurationError('Report exceeds 16 MiB');
  mkdirSync(dirname(directory), { recursive: true });
  mkdirSync(directory, { mode: 0o700 });
  const write = (name: string, content: string) => {
    const temporary = join(directory, name + '.tmp');
    writeFileSync(temporary, content + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(temporary, join(directory, name));
  };
  write('run.json', render(results, 'json'));
  write('events.jsonl', results.flatMap(result => result.events).map(event => JSON.stringify(event)).join('\n'));
  for (const format of requested) {
    if (format === 'junit') write('junit.xml', render(results, format));
    if (format === 'markdown') write('report.md', render(results, format));
    if (format === 'terminal') write('terminal.txt', render(results, format));
  }
}
async function main() {
  const parsed = parseArgs({ allowPositionals: true, strict: true, options: {
    help: { type: 'boolean', short: 'h' }, version: { type: 'boolean' },
    seed: { type: 'string' }, format: { type: 'string' }, out: { type: 'string' },
    'fail-on-inconclusive': { type: 'boolean' },
  } });
  const { values, positionals } = parsed;
  if (values.version) { console.log('0.1.0'); return 0; }
  if (values.help || !positionals.length) { console.log(help); return 0; }
  if (positionals.length > 2) throw new ConfigurationError('Too many positional arguments');
  const [command, target] = positionals;
  if (!['init', 'run', 'demo', 'report'].includes(command!)) throw new ConfigurationError('Unknown command; use --help');
  const requested = formats.parse((values.format ?? 'terminal').split(','));
  if (command === 'init') {
    const directory = resolve(target ?? 'interruptlab-example');
    if (existsSync(directory)) throw new ConfigurationError('init requires a new directory');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'driver.mjs'), `// Trusted local example: export a driver factory, not an already-running workflow.
export function createDriver() {
  let terminal;
  return {
    async start(ctx) {
      await ctx.step('create-invoice', async () => {
        await ctx.recordEffect({ operation: 'create-invoice', logicalOperationId: 'demo-42',
          idempotencyKey: 'demo-42', idempotent: true });
      });
      terminal = 'completed';
    },
    async requestCancel() {},
    async observe() { return terminal ? { terminal } : {}; }
  };
}
`, { flag: 'wx' });
    const scenario = scenarioSchema.parse({ schemaVersion: 1, id: 'example/invoice', entry: './driver.mjs',
      assertions: [{ type: 'effect_count', operation: 'create-invoice', groupBy: 'idempotencyKey', key: 'demo-42', exactly: 1 },
        { type: 'observed_terminal_state', anyOf: ['completed'] }, { type: 'observation_required', observer: 'fixture-snapshot' }] });
    writeFileSync(join(directory, 'scenario.json'), JSON.stringify(scenario, null, 2) + '\n', { flag: 'wx' });
    console.log('Created example. Run: interruptlab run <directory>/scenario.json');
    return 0;
  }
  if (command === 'run' && !target) throw new ConfigurationError('run requires a scenario file or directory');
  if (values.out && existsSync(resolve(values.out))) throw new ConfigurationError('Output directory already exists');
  let results: RunResult[];
  if (command === 'report') {
    if (!target) throw new ConfigurationError('report requires run.json');
    const artifact = z.object({ schemaVersion: z.literal(1), results: z.array(resultSchema).min(1).max(64) }).strict()
      .parse(JSON.parse(readBounded(resolve(target), 16 * 1024 * 1024)));
    results = artifact.results.map(result => redact(result));
  } else {
    const root = realpathSync(process.cwd());
    const jobs = command === 'demo' ? demoScenarios().map(scenario => ({ scenario, file: '' })) :
      loadScenarios(target ?? '.', root);
    if (values.seed !== undefined && !/^(0|[1-9][0-9]{0,9})$/.test(values.seed)) throw new ConfigurationError('Invalid seed');
    results = [];
    // Validate all entries before executing the first scenario.
    const entries = jobs.map(job => job.scenario.entry ? resolveEntry(job.scenario.entry, dirname(job.file), root) : undefined);
    for (const [index, job] of jobs.entries()) {
      const scenario = scenarioSchema.parse({ ...job.scenario, ...(values.seed !== undefined ? { seed: Number(values.seed) } : {}) });
      const result = await runIsolated(scenario, entries[index]);
      const file = job.file ? relative(root, job.file) : 'scenarios/' + scenario.driver + '.json';
      result.reproduction = 'interruptlab run ' + "'" + file.replace(/'/g, "'\\''") + "' --seed " + scenario.seed;
      results.push(redact(result, scenario.redact));
    }
  }
  const output = values.out ?? (command === 'report' ? undefined :
    join('.interruptlab', 'results', Date.now() + '-' + randomUUID()));
  if (output) writeReports(resolve(output), results, requested);
  for (const format of requested) console.log(render(results, format));
  if (results.some(result => result.classification === 'INCONCLUSIVE') &&
      !requested.includes('terminal') && !requested.includes('markdown')) {
    console.error('WARNING: INCONCLUSIVE evidence is not a conclusive pass; use --fail-on-inconclusive for CI.');
  }
  if (command === 'demo') {
    const expected = ['FAIL', 'PASS', 'PASS', 'INCONCLUSIVE', 'INCONCLUSIVE', 'HARNESS_ERROR', 'FAIL', 'PASS'];
    return results.every((result, index) => result.classification === expected[index]) ? 0 : 2;
  }
  return exitCode(results, values['fail-on-inconclusive']);
}
main().then(code => { process.exitCode = code; }).catch(error => {
  // Config errors are local authored metadata; do not echo arbitrary JSON/YAML values.
  console.error('HARNESS_ERROR: ' + (error instanceof ConfigurationError ?
    redact(error.message).slice(0, 240) : 'Invalid input, path, options or artifact; use --help and docs/troubleshooting.md'));
  process.exitCode = 2;
});
