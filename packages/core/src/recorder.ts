import { redact } from './privacy.js';
import { appendFileSync } from 'node:fs';
import { identifier, eventKinds } from './schema.js';
import type { RunEvent } from './types.js';
/** Append metadata-only events in authoritative order, with optional fresh JSONL sink. */
export function createRecorder(runId: string, scenarioId: string, jsonlPath?: string, redactPaths: string[] = []) {
  identifier.parse(runId); identifier.parse(scenarioId);
  const events: RunEvent[] = [];
  const started = performance.now();
  if (jsonlPath) appendFileSync(jsonlPath, '', { flag: 'wx', mode: 0o600 });
  return {
    record(kind: RunEvent['kind'], refs: Pick<RunEvent, 'stepId' | 'logicalOperationId' | 'effectId'> = {}): RunEvent {
      if (!eventKinds.includes(kind)) throw new Error('Unsupported event kind');
      if (events.length >= 10_000) throw new Error('Event limit exceeded');
      const safe: typeof refs = {};
      for (const key of ['stepId', 'logicalOperationId', 'effectId'] as const) {
        if (refs[key] !== undefined) safe[key] = identifier.parse(refs[key]);
      }
      const event: RunEvent = { ...safe, schemaVersion: 1, runId, scenarioId,
        sequence: events.length + 1, relativeMs: performance.now() - started, kind };
      if (jsonlPath) {
        const prefix = 'events.' + (event.sequence - 1) + '.';
        const paths = redactPaths.filter(path => path.startsWith(prefix)).map(path => 'events.0.' + path.slice(prefix.length));
        appendFileSync(jsonlPath, JSON.stringify(redact({ events: [event] }, paths).events[0]) + '\n', { mode: 0o600 });
      }
      events.push(event);
      return { ...event };
    },
    snapshot(): RunEvent[] { return events.map(event => ({ ...event })); },
    nextSequence(): number { return events.length + 1; },
  };
}
