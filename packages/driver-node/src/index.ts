import { CancellationError } from '../../core/src/runner.js';
import type { AgentDriver, ScenarioContext } from '../../core/src/types.js';
import type { Scenario } from '../../core/src/schema.js';
export type { AgentDriver, ScenarioContext } from '../../core/src/types.js';
/** Synthetic workflows for deterministic offline regression cases. */
export function createBuiltinDriver(kind: NonNullable<Scenario['driver']>): AgentDriver {
  let ctx: ScenarioContext;
  let terminal: 'completed' | 'canceled' | 'failed' | undefined;
  const invoice = async (idempotent: boolean) => {
    await ctx.step('create-invoice', async () => {
      await ctx.recordEffect({ operation: 'create-invoice', logicalOperationId: 'demo-42',
        idempotencyKey: 'demo-42', idempotent });
    });
  };
  return {
    async start(context) {
      ctx = context;
      if (kind === 'driver-error') throw new Error('Synthetic driver failure');
      if (kind === 'noncooperative') {
        await ctx.step('slow-read', () => new Promise<void>(() => {}));
        return;
      }
      if (kind === 'cooperative') {
        await ctx.step('slow-read', async () => {
          if (ctx.signal.aborted) throw new CancellationError();
          await new Promise<void>(resolve => ctx.signal.addEventListener('abort', () => resolve(), { once: true }));
          throw new CancellationError();
        });
        return;
      }
      if (kind === 'invoice-buggy' || kind === 'invoice-fixed') ctx.checkpoint('approval-42');
      await invoice(kind === 'invoice-fixed' || kind === 'approval');
      // Simulate a committed tool operation whose result was lost during cancellation.
      if ((kind === 'invoice-buggy' || kind === 'invoice-fixed') && ctx.signal.aborted) {
        terminal = 'canceled';
        throw new CancellationError();
      }
      ctx.checkpoint('approval-42');
      terminal = ctx.signal.aborted ? 'canceled' : 'completed';
    },
    async requestCancel() {
      if (kind === 'noncooperative') return;
      ctx.observeCancel();
      ctx.acknowledgeCancel();
      if (kind === 'cooperative') terminal = 'canceled';
    },
    async resume(receipt, context) {
      ctx = context;
      if (receipt !== 'approval-42') throw new Error('Unknown checkpoint');
      await invoice(kind === 'invoice-fixed' || kind === 'approval');
      terminal = 'completed';
    },
    async observe() { return terminal ? { terminal } : {}; },
  };
}
