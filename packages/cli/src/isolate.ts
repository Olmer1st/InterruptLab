import { fork } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { harnessError } from '../../core/src/runner.js';
import type { RunResult } from '../../core/src/types.js';
import type { Scenario } from '../../core/src/schema.js';
import { resultSchema } from '../../reporter/src/index.js';
/** Sequential child workers bound hangs and silence arbitrary driver output. */
export function runIsolated(scenario: Scenario, entry?: string): Promise<RunResult> {
  return new Promise(resolve => {
    const directory = mkdtempSync(join(tmpdir(), 'interruptlab-'));
    const child = fork(new URL('./worker.js', import.meta.url), [], {
      execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      // Drivers are trusted code, but the synthetic path never needs inherited credentials.
      env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, TEMP: process.env.TEMP },
    });
    let result = harnessError(scenario.id, scenario.seed, 'Driver worker exited without valid evidence');
    let done = false;
    const timer = setTimeout(() => {
      result = { ...result, classification: 'INCONCLUSIVE', rules: [{ rule: 'watchdog',
        classification: 'INCONCLUSIVE', message: 'Worker deadline exceeded; no trustworthy terminal observation',
        eventSequences: [] }] };
      child.kill('SIGKILL');
    }, scenario.timeoutMs + 1500);
    child.on('message', message => {
      const parsed = resultSchema.safeParse(message);
      if (parsed.success) result = parsed.data;
      child.kill('SIGKILL');
    });
    const finish = () => {
      if (done) return;
      done = true; clearTimeout(timer);
      rmSync(directory, { recursive: true, force: true });
      resolve(result);
    };
    child.on('error', finish);
    child.on('exit', finish);
    child.send({ scenario, ...(entry ? { entry } : {}), directory });
  });
}
