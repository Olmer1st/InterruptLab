import { InvoiceStore } from '../../packages/fixtures/src/index.js';
import { createRecorder } from '../../packages/core/src/index.js';
/** Re-enter a workflow after approval, reproducing an already committed write. */
export function runInvoiceWorkflow(path: string, idempotent: boolean) {
  const events = createRecorder('synthetic-run', 'invoice-resume');
  const key = 'demo-42';
  const execute = () => {
    events.record('step_started', { stepId: 'create-invoice' });
    const store = new InvoiceStore(path);
    const before = store.snapshot().length;
    const invoice = store.createInvoice(key, idempotent);
    if (store.snapshot().length > before) events.record('effect_committed',
      { effectId: invoice.effectId, logicalOperationId: key });
    events.record('step_completed', { stepId: 'create-invoice' });
  };
  execute();
  events.record('checkpoint_saved', { stepId: 'approval' });
  events.record('resume_started');
  execute();
  events.record('execution_terminated');
  // Reopen the store: the oracle reads persisted state, not a driver's success message.
  const invoices = new InvoiceStore(path).snapshot();
  return { classification: invoices.length === 1 ? 'PASS' : 'FAIL', invoices,
    events: events.snapshot() };
}
