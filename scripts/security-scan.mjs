import { readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const excluded = new Set(['node_modules', '.git', '.agents', '.aws', '.codex']);
const findings = [];
let files = 0;
function scan(text, label) {
  // Deliberately scoped scanner: report file labels, never suspected values.
  const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    /(?:ghp_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{32,}|AKIA[A-Z0-9]{16})/g];
  for (const pattern of patterns) if (pattern.test(text)) findings.push(label);
}
function visit(path) {
  for (const item of readdirSync(path, { withFileTypes: true })) {
    if (excluded.has(item.name) || item.isSymbolicLink()) continue;
    const target = join(path, item.name);
    if (item.isDirectory()) visit(target);
    else if (statSync(target).size <= 16 * 1024 * 1024) {
      files++; scan(readFileSync(target, 'utf8'), target);
    }
  }
}
visit('.');
let commits = [];
try { commits = execFileSync('git', ['rev-list', '--all'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean); }
catch { /* Unborn repository has no history. */ }
for (const sha of commits) scan(execFileSync('git', ['show', '--format=', sha], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }), 'commit:' + sha);
console.log(JSON.stringify({ scanner: 'limited credential-pattern scan; not comprehensive secret detection',
  files, commits: commits.length, findingLocations: [...new Set(findings)] }, null, 2));
process.exitCode = findings.length ? 1 : 0;
