import { CancellationError } from 'interruptlab';
// An existing workflow accepts an injected tool instead of knowing the harness.
async function workflow(createInvoice) {
  await createInvoice('example-order-42');
}
/** Adapt an existing workflow by instrumenting its steps and synthetic effects. */
export function createDriver() {
  let current;
  let terminal;
  const execute = async ctx => {
    current = ctx;
    try {
      await ctx.step('create-invoice', async () => {
        if (ctx.signal.aborted) throw new CancellationError();
        await workflow(key => ctx.recordEffect({ operation: 'create-invoice',
          logicalOperationId: key, idempotencyKey: key, idempotent: true }));
      });
      ctx.checkpoint('approval-receipt');
      terminal = 'completed';
    } catch (error) {
      if (ctx.signal.aborted) { terminal = 'canceled'; throw new CancellationError(); }
      terminal = 'failed';
      throw error;
    }
  };
  return {
    start: execute,
    async requestCancel() { current.observeCancel(); current.acknowledgeCancel(); },
    async resume(receipt, ctx) {
      if (receipt !== 'approval-receipt') throw new Error('Unknown receipt');
      await execute(ctx);
    },
    async observe() { return terminal ? { terminal } : {}; },
  };
}
