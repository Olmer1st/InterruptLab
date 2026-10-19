import { DatabaseSync } from 'node:sqlite';
import { chmodSync, lstatSync } from 'node:fs';
import { validateEffect } from '../../core/src/store.js';
import type { EffectInput, EffectStore, PhysicalEffect } from '../../core/src/types.js';
/** Isolated SQLite oracle. Always create a fresh database in a private temp directory. */
export class SQLiteEffectStore implements EffectStore {
  private db: DatabaseSync;
  private closed = false;
  constructor(path: string, private readonly visible = true) {
    try { lstatSync(path); throw new Error('Fixture path already exists'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    this.db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    this.db.exec(`
      PRAGMA journal_mode = DELETE;
      CREATE TABLE effects (
        effectId TEXT PRIMARY KEY, logicalOperationId TEXT NOT NULL,
        idempotencyKey TEXT NOT NULL, operation TEXT NOT NULL,
        sequence INTEGER NOT NULL, runId TEXT NOT NULL, committed INTEGER NOT NULL CHECK(committed = 1)
      );
      CREATE TABLE calls (count INTEGER NOT NULL);
      INSERT INTO calls VALUES (0);
    `);
  }
  /** Persist call count and physical effect atomically; parameterize every external value. */
  commit(input: EffectInput, sequence: number, runId: string) {
    if (this.closed) throw new Error('Fixture closed');
    validateEffect(input);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec('UPDATE calls SET count = count + 1');
      const old = this.db.prepare('SELECT * FROM effects WHERE operation = ? AND idempotencyKey = ? ORDER BY sequence LIMIT 1')
        .get(input.operation, input.idempotencyKey) as unknown as PhysicalEffect | undefined;
      if (input.idempotent && old) {
        this.db.exec('COMMIT');
        return { effect: { ...old, committed: true as const }, created: false };
      }
      const count = this.db.prepare('SELECT COUNT(*) AS n FROM effects').get()!.n as number;
      if (count >= 10000) throw new Error('Effect limit exceeded');
      const effect: PhysicalEffect = { effectId: 'inv-' + (count + 1), logicalOperationId: input.logicalOperationId,
        idempotencyKey: input.idempotencyKey, operation: input.operation, sequence, runId, committed: true };
      this.db.prepare('INSERT INTO effects VALUES (?, ?, ?, ?, ?, ?, 1)').run(effect.effectId,
        effect.logicalOperationId, effect.idempotencyKey, effect.operation, effect.sequence, effect.runId);
      this.db.exec('COMMIT');
      return { effect, created: true };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  /** Read actual DB rows, not acknowledgement messages or an in-memory copy. */
  snapshot(): PhysicalEffect[] | undefined {
    if (this.closed) throw new Error('Fixture closed');
    if (!this.visible) return undefined;
    return (this.db.prepare('SELECT * FROM effects ORDER BY sequence').all() as unknown as PhysicalEffect[])
      .map(row => ({ ...row, committed: true as const }));
  }
  /** Number of calls, including deduplicated attempts. */
  callCount(): number {
    if (this.closed) throw new Error('Fixture closed');
    return this.db.prepare('SELECT count FROM calls').get()!.count as number;
  }
  /** Close before removing the private fixture directory. */
  close(): void { if (!this.closed) { this.db.close(); this.closed = true; } }
}
