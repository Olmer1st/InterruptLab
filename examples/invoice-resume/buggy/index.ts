import { runInvoiceWorkflow } from '../workflow.js';
/** Re-execute the write without deduplication after approval. */
export const runBuggy = (path: string) => runInvoiceWorkflow(path, false);
