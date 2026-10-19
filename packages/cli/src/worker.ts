import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { runScenario, harnessError } from '../../core/src/runner.js';
import { MemoryEffectStore } from '../../core/src/store.js';
import type { AgentDriver } from '../../core/src/types.js';
import type { Scenario } from '../../core/src/schema.js';
import { SQLiteEffectStore } from '../../fixtures/src/sqlite.js';
import { createBuiltinDriver } from '../../driver-node/src/index.js';
process.once('message', async (job: { scenario: Scenario; entry?: string; directory: string }) => {
  const { scenario } = job;
  let store: SQLiteEffectStore | MemoryEffectStore | undefined;
  try {
    const visible = scenario.driver !== 'missing-observer';
    store = scenario.fixture === 'sqlite' ?
      new SQLiteEffectStore(join(job.directory, 'fixture.sqlite'), visible) : new MemoryEffectStore(visible);
    const driver: AgentDriver = scenario.driver ? createBuiltinDriver(scenario.driver) :
      await (await import(pathToFileURL(job.entry!).href)).createDriver();
    let result = await runScenario(scenario, driver, { store });
    if (store instanceof SQLiteEffectStore) store.close();
    if (Buffer.byteLength(JSON.stringify(result)) > 128 * 1024) {
      result = harnessError(scenario.id, scenario.seed, 'Evidence exceeds the 128 KiB per-run report limit');
    }
    process.send?.(result, () => process.exit(0));
  } catch {
    if (store instanceof SQLiteEffectStore) store.close();
    process.send?.(harnessError(scenario.id, scenario.seed), () => process.exit(0));
  }
});
