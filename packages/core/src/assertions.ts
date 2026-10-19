import type { Assertion } from './schema.js';
import type { Classification, PhysicalEffect, RuleResult, RunEvent } from './types.js';
/** Higher-priority evidence wins without hiding lower-priority rule outcomes. */
export function classify(statuses: Classification[]): Classification {
  return (['HARNESS_ERROR', 'FAIL', 'INCONCLUSIVE', 'PASS'] as const)
    .find(status => statuses.includes(status)) ?? 'INCONCLUSIVE';
}
/** Evaluate declared invariants against physical state and recorded lifecycle. */
export function evaluateAssertions(assertions: Assertion[], evidence: {
  events: RunEvent[]; effects: PhysicalEffect[] | undefined; terminal: string | undefined;
  checkpointEffects: string[] | undefined; resumed: boolean; receipt: string | undefined;
}): RuleResult[] {
  const { events, effects, terminal } = evidence;
  return assertions.map(assertion => {
    const result = (classification: Classification, message: string, sequences: number[] = []): RuleResult =>
      ({ rule: assertion.type, classification, message, eventSequences: sequences });
    const unknown = () => result('INCONCLUSIVE', 'Required observation is unavailable');
    switch (assertion.type) {
      case 'observation_required': return effects ? result('PASS', 'Fixture snapshot observed') : unknown();
      case 'observed_terminal_state':
        return terminal ? result(assertion.anyOf.includes(terminal as 'completed' | 'canceled' | 'failed') ? 'PASS' : 'FAIL',
          'Observed terminal state: ' + terminal) : unknown();
      case 'cancel_propagated': {
        const kinds = ['cancel_requested', 'cancel_observed', 'cancel_acknowledged'] as const;
        const chain = kinds.map(kind => events.find(event => event.kind === kind));
        if (!chain[0]) return unknown();
        if (!chain[1] || !chain[2]) return result(terminal ? 'FAIL' : 'INCONCLUSIVE', 'Cancellation observation or acknowledgement absent');
        const ordered = chain[0].sequence < chain[1].sequence && chain[1].sequence < chain[2].sequence;
        return result(ordered ? 'PASS' : 'FAIL', 'Request, observation and acknowledgement are distinct', chain.map(e => e!.sequence));
      }
      case 'effect_count': {
        if (!effects) return unknown();
        const rows = effects.filter(row => row.operation === assertion.operation);
        const counts = new Map<string, number>();
        for (const row of rows) counts.set(row.idempotencyKey, (counts.get(row.idempotencyKey) ?? 0) + 1);
        const keys = assertion.key ? [assertion.key] : [...counts.keys()];
        if (keys.length === 0) return result(assertion.exactly === 0 ? 'PASS' : 'INCONCLUSIVE', 'No logical key was observed; specify key to assert absence');
        const ok = keys.every(key => (counts.get(key) ?? 0) === assertion.exactly);
        return result(ok ? 'PASS' : 'FAIL', 'Committed effects: ' + rows.length + '; expected ' + assertion.exactly + ' per key; observed ' + keys.slice(0, 8).map(key => key + '=' + (counts.get(key) ?? 0)).join(', '),
          rows.map(row => row.sequence));
      }
      case 'no_forbidden_commit_after': {
        if (!effects) return unknown();
        const barrier = events.find(event => event.kind === assertion.barrier);
        if (!barrier) return unknown();
        const late = effects.filter(row => row.sequence > barrier.sequence &&
          (!assertion.operation || row.operation === assertion.operation));
        return result(late.length ? 'FAIL' : 'PASS', 'Forbidden commits after ' + assertion.barrier + ': ' + late.length,
          [barrier.sequence, ...late.map(row => row.sequence)]);
      }
      case 'resume_checkpoint_consistency': {
        if (!effects || !evidence.checkpointEffects || !evidence.receipt || !evidence.resumed) return unknown();
        const retained = evidence.checkpointEffects.every(id => effects.some(row => row.effectId === id));
        // A replay must retain old effects and must not repeat their logical keys.
        const unique = new Set(effects.map(row => JSON.stringify([row.operation, row.idempotencyKey]))).size === effects.length;
        return result(retained && unique ? 'PASS' : 'FAIL', 'Checkpoint effects retained without duplicate logical operations');
      }
    }
  });
}
