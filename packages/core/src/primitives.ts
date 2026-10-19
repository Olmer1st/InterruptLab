import type { EffectInput, ScenarioContext } from './types.js';
/** Instrument one step using the active scenario context. */
export const step = <T>(ctx: ScenarioContext, operation: string, work: () => Promise<T>) => ctx.step(operation, work);
/** Save an application-defined resume receipt in the scenario context. */
export const checkpoint = (ctx: ScenarioContext, receipt: string) => ctx.checkpoint(receipt);
/** Request cancellation; callers must separately observe and acknowledge it. */
export const requestCancel = (ctx: ScenarioContext) => ctx.requestCancel();
/** Commit a synthetic effect through the trusted fixture oracle. */
export const recordEffect = (ctx: ScenarioContext, input: EffectInput) => ctx.recordEffect(input);
/** Observe physical fixture state; undefined means unavailable. */
export const observeState = (ctx: ScenarioContext) => ctx.observeState();
