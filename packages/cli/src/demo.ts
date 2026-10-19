import { scenarioSchema } from '../../core/src/schema.js';
import type { Scenario } from '../../core/src/schema.js';
/** Eight synthetic cases include intentional failures and missing-evidence controls. */
export function demoScenarios(): Scenario[] {
  const count = { type: 'effect_count', operation: 'create-invoice', groupBy: 'idempotencyKey', key: 'demo-42', exactly: 1 };
  const terminal = { type: 'observed_terminal_state', anyOf: ['completed', 'canceled'] };
  const observer = { type: 'observation_required', observer: 'fixture-snapshot' };
  return [
    ...(['invoice-buggy', 'invoice-fixed'] as const).map(driver => ({
      schemaVersion: 1, id: 'resume/' + driver, driver,
      cancel: { at: 'after-effect-commit-before-response', operation: 'create-invoice', graceMs: 500 },
      resume: { enabled: true }, assertions: [count, observer, terminal, { type: 'resume_checkpoint_consistency' }],
    })),
    { schemaVersion: 1, id: 'cancel/cooperative', driver: 'cooperative',
      cancel: { at: 'after-step-start', operation: 'slow-read' },
      assertions: [{ type: 'cancel_propagated' }, terminal, observer] },
    { schemaVersion: 1, id: 'cancel/noncooperative', driver: 'noncooperative',
      cancel: { at: 'after-step-start', operation: 'slow-read', graceMs: 30 },
      assertions: [{ type: 'cancel_propagated' }, terminal] },
    { schemaVersion: 1, id: 'effects/missing-observer', driver: 'missing-observer',
      assertions: [count, observer, terminal] },
    { schemaVersion: 1, id: 'driver/error', driver: 'driver-error', assertions: [terminal] },
    { schemaVersion: 1, id: 'effects/late-commit', driver: 'late-commit',
      cancel: { at: 'before-effect-commit', operation: 'create-invoice' },
      assertions: [{ type: 'no_forbidden_commit_after', barrier: 'cancel_acknowledged' }, { type: 'cancel_propagated' }, observer, terminal] },
    { schemaVersion: 1, id: 'resume/approval', driver: 'approval', resume: { enabled: true },
      assertions: [count, observer, terminal, { type: 'resume_checkpoint_consistency' }] },
  ].map(value => scenarioSchema.parse(value));
}
