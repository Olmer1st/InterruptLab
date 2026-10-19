/** Results never equate missing evidence with success. */
export type Classification = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'HARNESS_ERROR';
/** Metadata-only event; sequence is authoritative and relativeMs is diagnostic. */
export interface RunEvent {
  schemaVersion: 1; runId: string; scenarioId: string; sequence: number; relativeMs: number;
  kind: (typeof import('./schema.js').eventKinds)[number];
  stepId?: string | undefined; logicalOperationId?: string | undefined; effectId?: string | undefined;
}
/** An observed physical write, separate from a tool call or acknowledgement. */
export interface PhysicalEffect {
  effectId: string; logicalOperationId: string; idempotencyKey: string;
  operation: string; sequence: number; runId: string; committed: true;
}
/** One attempted logical effect. */
export interface EffectInput { operation: string; logicalOperationId: string; idempotencyKey: string; idempotent?: boolean }
/** Trusted fixture contract; undefined snapshot means visibility is absent. */
export interface EffectStore {
  commit(input: EffectInput, sequence: number, runId: string): { effect: PhysicalEffect; created: boolean };
  snapshot(): PhysicalEffect[] | undefined;
  callCount(): number;
}
/** Cooperative instrumentation. A revoked context refuses late writes. */
export interface ScenarioContext {
  readonly signal: AbortSignal;
  readonly seed: number;
  step<T>(operation: string, work: () => Promise<T>): Promise<T>;
  barrier(site: (typeof import('./schema.js').boundaries)[number], operation: string): Promise<void>;
  checkpoint(receipt: string): void;
  requestCancel(reason?: string): Promise<void>;
  observeCancel(): void;
  acknowledgeCancel(): void;
  recordEffect(input: EffectInput): Promise<PhysicalEffect>;
  observeState(): PhysicalEffect[] | undefined;
}
/** Only observe() establishes a terminal state; a resolved start is insufficient. */
export interface AgentDriver {
  start(ctx: ScenarioContext): Promise<void>;
  requestCancel(reason: string): Promise<void>;
  resume?(receipt: string, ctx: ScenarioContext): Promise<void>;
  observe(): Promise<{ terminal?: 'completed' | 'canceled' | 'failed' }>;
}
/** Evidence for a single rule, with relevant sequence references. */
export interface RuleResult { rule: string; classification: Classification; message: string; eventSequences: number[] }
/** Portable version-one evidence artifact; no raw arguments or driver errors. */
export interface RunResult {
  schemaVersion: 1; scenarioId: string; seed: number; runId: string;
  classification: Classification; rules: RuleResult[]; events: RunEvent[];
  initialFixtureHash: string; effects: PhysicalEffect[] | null; callCount: number;
  terminal: string | null; boundaryReached: boolean; checkpoint: string | null;
  environment: { node: string; platform: string; version: string };
  reproduction: string; limitations: string[];
}
