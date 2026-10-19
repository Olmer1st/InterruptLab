import { identifier } from './schema.js';
import type { EffectInput, EffectStore, PhysicalEffect } from './types.js';
/** Validate the metadata allowed to reach physical fixtures and reports. */
export function validateEffect(input: EffectInput): void {
  identifier.parse(input.operation); identifier.parse(input.logicalOperationId); identifier.parse(input.idempotencyKey);
  if (input.idempotent !== undefined && typeof input.idempotent !== 'boolean') throw new Error('Invalid idempotency flag');
}
/** Ephemeral oracle for lightweight callers; SQLite is the CLI default. */
export class MemoryEffectStore implements EffectStore {
  private rows: PhysicalEffect[] = [];
  private calls = 0;
  constructor(private readonly visible = true) {}
  /** Count physical tool calls even when idempotency prevents another write. */
  commit(input: EffectInput, sequence: number, runId: string) {
    validateEffect(input);
    this.calls++;
    const existing = this.rows.find(row => row.operation === input.operation && row.idempotencyKey === input.idempotencyKey);
    if (input.idempotent && existing) return { effect: { ...existing }, created: false };
    if (this.rows.length >= 10000) throw new Error('Effect limit exceeded');
    const effect = { effectId: 'inv-' + (this.rows.length + 1), logicalOperationId: input.logicalOperationId,
      idempotencyKey: input.idempotencyKey, operation: input.operation, sequence, runId, committed: true as const };
    this.rows.push(effect);
    return { effect: { ...effect }, created: true };
  }
  /** Return a copy, or explicitly report unavailable observation. */
  snapshot() { return this.visible ? this.rows.map(row => ({ ...row })) : undefined; }
  /** Total attempted commits. */
  callCount() { return this.calls; }
}
