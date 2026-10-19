import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const directory = mkdtempSync(join(tmpdir(), 'interruptlab-package-'));
const env = { ...process.env, npm_config_cache: join(directory, 'npm-cache') };
const execute = (command, args, cwd = directory) => execFileSync(command, args,
  { cwd, env, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
try {
  execute('npm', ['pack', '--dry-run', '--json'], root);
  const [packed] = JSON.parse(execute('npm', ['pack', '--json', '--pack-destination', directory], root));
  assert(!packed.files.some(file => /(^|\/)(node_modules|tests|\.env|fixture\.sqlite)(\/|$)/.test(file.path)));
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'consumer-smoke', private: true, type: 'module' }));
  execute('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(directory, packed.filename)]);
  assert(execute('npm', ['exec', '--offline', '--', 'interruptlab', '--help']).includes('Usage:'));
  execute('npm', ['exec', '--offline', '--', 'interruptlab', 'init', 'sample']);
  execute('npm', ['exec', '--offline', '--', 'interruptlab', 'run', 'sample/scenario.json', '--out', 'reports']);
  const report = JSON.parse(readFileSync(join(directory, 'reports/run.json'), 'utf8'));
  assert.equal(report.results[0].classification, 'PASS');
  execute('npm', ['exec', '--offline', '--', 'interruptlab', 'demo']);
  writeFileSync(join(directory, 'smoke.mjs'), `
    import { runScenario, scenarioSchema } from 'interruptlab';
    import { createBuiltinDriver } from 'interruptlab/driver-node';
    import { MemoryEffectStore } from 'interruptlab/fixtures';
    import { render } from 'interruptlab/reporter';
    const scenario = scenarioSchema.parse({ schemaVersion:1,id:'installed',driver:'invoice-fixed',
      assertions:[{type:'observed_terminal_state',anyOf:['completed']}] });
    const result = await runScenario(scenario, createBuiltinDriver('invoice-fixed'), {store:new MemoryEffectStore()});
    if(result.classification !== 'PASS') throw new Error(render([result],'terminal'));
  `);
  execute(process.execPath, ['smoke.mjs']);
  writeFileSync(join(directory, 'types.ts'), `
    import { runScenario, type AgentDriver, type ScenarioInput } from 'interruptlab';
    import { MemoryEffectStore } from 'interruptlab/fixtures';
    import { createBuiltinDriver } from 'interruptlab/driver-node';
    import { render } from 'interruptlab/reporter';
    const driver: AgentDriver = createBuiltinDriver('invoice-fixed');
    const input: ScenarioInput = {schemaVersion:1,id:'consumer',driver:'invoice-fixed',
      assertions:[{type:'observed_terminal_state',anyOf:['completed']}]};
    const result = await runScenario(input, driver, {store:new MemoryEffectStore()});
    render([result], 'json');
  `);
  execute(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict',
    '--module', 'NodeNext', '--target', 'ES2022', '--skipLibCheck',
    '--typeRoots', resolve(root, 'node_modules/@types'), 'types.ts']);
  console.log(JSON.stringify({ package: packed.filename, files: packed.files.length,
    unpackedSize: packed.unpackedSize, integrity: packed.integrity, installedCli: 'PASS', exports: 'PASS',
    consumerTypes: 'PASS', initRun: 'PASS', demo: 'PASS', node: process.version, platform: process.platform }, null, 2));
} finally { rmSync(directory, { recursive: true, force: true }); }
