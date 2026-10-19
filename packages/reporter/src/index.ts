import { z } from 'zod';
import { eventKinds } from '../../core/src/schema.js';
import { classify } from '../../core/src/assertions.js';
import type { Classification, RunResult } from '../../core/src/types.js';
export type { Classification } from '../../core/src/types.js';
const status = z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'HARNESS_ERROR']);
const text = z.string().max(1000);
const effect = z.object({ effectId: text, logicalOperationId: text, idempotencyKey: text, operation: text,
  sequence: z.number().int().positive(), runId: text, committed: z.literal(true) }).strict();
/** Reject malformed/unbounded imported artifacts instead of trusting a report file. */
export const resultSchema = z.object({
  schemaVersion: z.literal(1), scenarioId: text, seed: z.number().int(), runId: text, classification: status,
  rules: z.array(z.object({ rule: text, classification: status, message: text,
    eventSequences: z.array(z.number().int()).max(10000) }).strict()).min(1).max(70),
  events: z.array(z.object({ schemaVersion: z.literal(1), runId: text, scenarioId: text,
    sequence: z.number().int().positive(), relativeMs: z.number().nonnegative(),
    kind: z.enum(eventKinds),
    stepId: text.optional(), logicalOperationId: text.optional(), effectId: text.optional() }).strict()).max(10000),
  initialFixtureHash: text, effects: z.array(effect).max(10000).nullable(), callCount: z.number().int().nonnegative(),
  terminal: text.nullable(), boundaryReached: z.boolean(), checkpoint: text.nullable(),
  environment: z.object({ node: text, platform: text, version: text }).strict(),
  reproduction: text, limitations: z.array(text).max(10),
}).strict().superRefine((result, ctx) => {
  if (classify(result.rules.map(rule => rule.classification)) !== result.classification) {
    ctx.addIssue({ code: 'custom', path: ['classification'], message: 'Outcome disagrees with rule evidence' });
  }
});

export { redact } from '../../core/src/privacy.js';
/** Escape XML metacharacters and remove invalid XML 1.0 characters. */
export function escapeXml(value: string): string {
  return Array.from(value).filter(char => {
    const n = char.codePointAt(0)!;
    return n === 9 || n === 10 || n === 13 || (n >= 32 && n <= 0xd7ff) || (n >= 0xe000 && n <= 0xfffd) || (n >= 0x10000 && n <= 0x10ffff);
  }).join('').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
/** Exit policy: harness/config > invariant failure > opt-in inconclusive > success. */
export function exitCode(results: Pick<RunResult, 'classification'>[], failOnInconclusive = false): number {
  if (results.some(result => result.classification === 'HARNESS_ERROR')) return 2;
  if (results.some(result => result.classification === 'FAIL')) return 1;
  if (failOnInconclusive && results.some(result => result.classification === 'INCONCLUSIVE')) return 3;
  return 0;
}
/** Render reports from the same canonical, already-redacted result list. */
export function render(results: RunResult[], format: 'terminal' | 'json' | 'junit' | 'markdown'): string {
  if (format === 'json') return JSON.stringify({ schemaVersion: 1, results }, null, 2);
  if (format === 'junit') {
    const count = (classification: Classification) => results.filter(result => result.classification === classification).length;
    return '<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="InterruptLab" tests="' + results.length +
      '" failures="' + count('FAIL') + '" errors="' + count('HARNESS_ERROR') + '" skipped="' + count('INCONCLUSIVE') + '">' +
      results.map(result => {
        const message = result.rules.filter(rule => rule.classification !== 'PASS').map(rule => rule.message).join('; ');
        const tag = result.classification === 'FAIL' ? 'failure' : result.classification === 'HARNESS_ERROR' ? 'error' :
          result.classification === 'INCONCLUSIVE' ? 'skipped' : undefined;
        return '<testcase name="' + escapeXml(result.scenarioId) + '" classname="interruptlab">' +
          (tag ? '<' + tag + ' message="' + escapeXml(message) + '"/>' : '') + '</testcase>';
      }).join('') + '</testsuite>';
  }
  const lines = results.map(result => {
    const details = result.rules.map(rule => '  ' + rule.classification + ' ' + rule.rule + ': ' + rule.message).join('\n');
    const effects = result.effects?.map(effect => effect.effectId + '@' + effect.sequence).join(', ') ?? 'unobserved';
    return result.classification + ' ' + result.scenarioId + '\n' + details + '\n  Physical effects: ' + effects +
      '\n  Reproduce: ' + result.reproduction +
      (result.classification === 'INCONCLUSIVE' ? '\n  WARNING: incomplete evidence; this is not a conclusive pass.' : '');
  });
  return format === 'markdown' ? '# InterruptLab results\n\n' + lines.map(line => '~~~~text\n' + line + '\n~~~~').join('\n\n') : lines.join('\n\n');
}
