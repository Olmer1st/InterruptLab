/** Defense in depth for portable reports; raw arguments are excluded upstream. */
export function redact<T>(input: T, paths: string[] = []): T {
  const sensitive = /^(password|secret|token|authorization|api[-_]?key|credentials)$/i;
  const visit = (value: unknown, path: string): unknown => {
    if (paths.includes(path) && typeof value === 'string' &&
        /^(effects|events)\.[0-9]+\.(effectId|logicalOperationId|idempotencyKey|operation|stepId|runId)$/.test(path)) return '[REDACTED]';
    if (typeof value === 'string') return value.replace(/(?:sk-[a-zA-Z0-9_-]{8,}|gh[pousr]_[a-zA-Z0-9_]{8,}|Bearer\s+[^\s]+|AKIA[A-Z0-9]{16})/g, '[REDACTED]').slice(0, 1000);
    if (Array.isArray(value)) return value.map((entry, index) => visit(entry, path ? path + '.' + index : String(index)));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
      [key, sensitive.test(key) ? '[REDACTED]' : visit(entry, path ? path + '.' + key : key)]));
    return value;
  };
  return visit(input, '') as T;
}
