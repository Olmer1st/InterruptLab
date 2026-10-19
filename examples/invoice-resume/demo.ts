import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBuggy } from './buggy/index.js';
import { runFixed } from './fixed/index.js';
const dir = mkdtempSync(join(tmpdir(), 'interruptlab-'));
try {
  for (const [name, run] of [['buggy', runBuggy], ['fixed', runFixed]] as const) {
    console.log(JSON.stringify({ variant: name, ...run(join(dir, name + '.jsonl')) }, null, 2));
  }
} finally { rmSync(dir, { recursive: true }); }
