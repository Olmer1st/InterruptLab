import { z } from 'zod';
/** Stable metadata event vocabulary shared by recording and imported report validation. */
export const eventKinds = ['step_started', 'step_completed', 'barrier_reached', 'cancel_requested',
  'cancel_observed', 'cancel_acknowledged', 'effect_started', 'effect_committed', 'effect_failed',
  'checkpoint_saved', 'resume_started', 'execution_terminated', 'observation_missing'] as const;
/** Four supported deterministic injection sites. */
export const boundaries = ['before-step', 'after-step-start', 'before-effect-commit', 'after-effect-commit-before-response'] as const;
/** Bounded identifiers prevent payloads from becoming event metadata. */
export const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,95}$/);
const duration = z.number().int().min(1).max(60_000);
const effectCount = z.object({ type: z.literal('effect_count'), operation: identifier,
  groupBy: z.literal('idempotencyKey'), exactly: z.number().int().min(0).max(10000),
  key: identifier.optional() }).strict();
const forbidden = z.object({ type: z.literal('no_forbidden_commit_after'),
  barrier: z.enum(['cancel_requested', 'cancel_observed', 'cancel_acknowledged', 'execution_terminated']),
  operation: identifier.optional() }).strict();
/** Versioned assertion union; unknown keys are configuration errors. */
export const assertionSchema = z.discriminatedUnion('type', [
  effectCount, forbidden,
  z.object({ type: z.literal('cancel_propagated') }).strict(),
  z.object({ type: z.literal('observed_terminal_state'), anyOf: z.array(z.enum(['completed', 'canceled', 'failed'])).min(1) }).strict(),
  z.object({ type: z.literal('observation_required'), observer: z.literal('fixture-snapshot') }).strict(),
  z.object({ type: z.literal('resume_checkpoint_consistency') }).strict(),
]);
/** Known offline example drivers, not arbitrary command execution. */
export const builtinDrivers = ['invoice-buggy', 'invoice-fixed', 'cooperative', 'noncooperative',
  'missing-observer', 'driver-error', 'late-commit', 'approval'] as const;
/** Strict configuration is shared by API and CLI, never coerced from unchecked input. */
export const scenarioSchema = z.object({
  schemaVersion: z.literal(1), id: identifier,
  driver: z.enum(builtinDrivers).optional(),
  entry: z.string().min(1).max(240).optional(),
  fixture: z.enum(['sqlite', 'memory']).default('sqlite'),
  seed: z.number().int().min(0).max(2147483647).default(42),
  timeoutMs: duration.default(2000), stepTimeoutMs: duration.default(1000),
  cancel: z.object({ at: z.enum(boundaries), operation: identifier,
    occurrence: z.number().int().min(1).max(10000).default(1), graceMs: duration.default(500) }).strict().optional(),
  resume: z.object({ enabled: z.boolean() }).strict().default({ enabled: false }),
  assertions: z.array(assertionSchema).min(1).max(64),
  redact: z.array(z.string().regex(/^[a-zA-Z0-9_.]+$/).max(160)).max(32).default([]),
}).strict().superRefine((value, ctx) => {
  if (Boolean(value.driver) === Boolean(value.entry)) ctx.addIssue({ code: 'custom',
    path: ['entry'], message: 'Specify exactly one of driver or entry' });
});
/** Parsed, defaulted version-one scenario. */
export type Scenario = z.infer<typeof scenarioSchema>;
/** User-authored version-one scenario before defaults. */
export type ScenarioInput = z.input<typeof scenarioSchema>;
/** One declared invariant. */
export type Assertion = z.infer<typeof assertionSchema>;
