import { cpSync, chmodSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
rmSync('dist', { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });
// Bundle runtime entrypoints so a single tarball is independent of workspace links.
for (const name of ['core', 'cli', 'driver-node', 'fixtures', 'reporter']) {
  rmSync('packages/' + name + '/dist', { recursive: true, force: true });
  cpSync('dist/packages/' + name + '/src', 'packages/' + name + '/dist', { recursive: true });
  await build({ entryPoints: ['packages/' + name + '/src/index.ts'],
    outfile: 'dist/runtime/' + name + '.js', bundle: true, platform: 'node',
    format: 'esm', target: 'node22', external: ['zod', 'yaml'] });
  cpSync('dist/runtime/' + name + '.js', 'packages/' + name + '/dist/index.js');
}
await build({ entryPoints: ['packages/cli/src/worker.ts'], outfile: 'dist/runtime/worker.js',
  bundle: true, platform: 'node', format: 'esm', target: 'node22', external: ['zod', 'yaml'] });
chmodSync('dist/runtime/cli.js', 0o755);
cpSync('dist/runtime/cli.js', 'packages/cli/dist/index.js');
cpSync('dist/runtime/worker.js', 'packages/cli/dist/worker.js');
