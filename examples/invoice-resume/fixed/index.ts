import { runInvoiceWorkflow } from '../workflow.js';
/** Preserve a stable operation key across approval and resume. */
export const runFixed = (path: string) => runInvoiceWorkflow(path, true);
