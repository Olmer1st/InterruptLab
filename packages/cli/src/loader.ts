import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseDocument } from 'yaml';
import { scenarioSchema } from '../../core/src/schema.js';
import type { Scenario } from '../../core/src/schema.js';
/** Sanitized authored-config diagnostic; raw parser and OS errors are never echoed. */
export class ConfigurationError extends Error {}
/** Enforce actual filesystem containment, including symlink targets. */
export function inside(root: string, target: string): boolean {
  const rel = relative(realpathSync(root), realpathSync(target));
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}
/** Read bounded UTF-8 configuration/report files. */
export function readBounded(path: string, limit = 65536): string {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > limit) throw new ConfigurationError('Input must be a bounded regular file');
  return readFileSync(path, 'utf8');
}
/** Load YAML/JSON deterministically before executing any driver. */
export function loadScenarios(path: string, root: string): { scenario: Scenario; file: string }[] {
  const files: string[] = [];
  const visit = (target: string, depth: number) => {
    if (depth > 4 || files.length >= 64) throw new ConfigurationError('Scenario directory limit exceeded');
    if (!inside(root, target) || lstatSync(target).isSymbolicLink()) throw new ConfigurationError('Scenario path must stay within the trusted project');
    if (statSync(target).isDirectory()) {
      for (const entry of readdirSync(target).sort()) visit(resolve(target, entry), depth + 1);
    } else if (['.yaml', '.yml', '.json'].includes(extname(target))) files.push(target);
  };
  visit(resolve(path), 0);
  if (!files.length) throw new ConfigurationError('No YAML or JSON scenarios found');
  const ids = new Set<string>();
  return files.map(file => {
    const doc = parseDocument(readBounded(file), { uniqueKeys: true, strict: true });
    if (doc.errors.length) {
      const position = doc.errors[0]?.linePos?.[0];
      throw new ConfigurationError('Invalid YAML in ' + file.split(sep).pop() + ' at line ' + (position?.line ?? '?') + ', column ' + (position?.col ?? '?'));
    }
    const parsed = scenarioSchema.safeParse(doc.toJS({ maxAliasCount: 20 }));
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      const keyPath = issue.path.join('.') || ('keys' in issue ? (issue.keys as string[]).join(',') : 'root');
      throw new ConfigurationError('Invalid scenario ' + file.split(sep).pop() + ' at ' + keyPath + ': ' + issue.code);
    }
    if (ids.has(parsed.data.id)) throw new ConfigurationError('Duplicate scenario ID');
    ids.add(parsed.data.id);
    return { scenario: parsed.data, file };
  });
}
/** Resolve only local JS modules; scenario files cannot escape the trusted root. */
export function resolveEntry(entry: string, directory: string, root: string): string {
  if (isAbsolute(entry) || !['.mjs', '.js'].includes(extname(entry))) throw new ConfigurationError('entry must be a relative .js or .mjs driver');
  const target = resolve(directory, entry);
  if (!inside(root, target)) throw new ConfigurationError('Driver must stay within the trusted project');
  return realpathSync(target);
}
