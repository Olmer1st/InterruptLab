import { appendFileSync, readFileSync, statSync } from 'node:fs';
/** One synthetic durable effect. No customer data or payment API is involved. */
export interface Invoice { effectId: string; logicalOperationId: string }
/** Minimal persistent fake store, deliberately single-process and not production-safe. */
export class InvoiceStore {
  constructor(private readonly path: string) {}
  /** Read physical effects from disk; malformed or oversized state fails closed. */
  snapshot(): Invoice[] {
    let source: string;
    try {
      if (statSync(this.path).size > 65536) throw new Error('Fixture exceeds 64 KiB');
      source = readFileSync(this.path, 'utf8');
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    if (Buffer.byteLength(source) > 65536) throw new Error('Fixture exceeds 64 KiB');
    return source.trim() === '' ? [] : source.trim().split('\n').map(line => {
      const value: unknown = JSON.parse(line);
      if (!value || typeof value !== 'object' ||
          !('effectId' in value) || typeof value.effectId !== 'string' ||
          !('logicalOperationId' in value) || typeof value.logicalOperationId !== 'string') {
        throw new Error('Invalid fixture row');
      }
      return { effectId: value.effectId, logicalOperationId: value.logicalOperationId };
    });
  }
  /** Commit one effect, optionally deduplicating by a stable logical key. */
  createInvoice(key: string, idempotent: boolean): Invoice {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(key)) throw new Error('Invalid operation key');
    const rows = this.snapshot();
    const previous = rows.find(row => row.logicalOperationId === key);
    if (idempotent && previous) return previous;
    const row = { effectId: 'inv-' + (rows.length + 1), logicalOperationId: key };
    appendFileSync(this.path, JSON.stringify(row) + '\n', { mode: 0o600 });
    return row;
  }
}

export { SQLiteEffectStore } from './sqlite.js';
export { MemoryEffectStore } from '../../core/src/store.js';
