# Troubleshooting
- **Cannot import node:sqlite:** use the pinned Node 22.22.3 runtime. Its experimental
  SQLite warning is expected. Other runtimes are not claimed supported.
- **Cannot find dist or package entrypoint:** run npm ci then npm run build at the root.
  Builds clean generated output before compiling/bundling.
- **npm cache permission error:** choose a writable cache:
  npm ci --cache /tmp/interruptlab-npm-cache (Linux example).
- **Output directory already exists:** select a fresh --out directory. No reports
  are overwritten. Interrupted writes may leave .tmp files in the failed output.
- **Driver path rejected:** use a relative .js/.mjs module inside the invoking project.
  Compile TypeScript first; escaping symlinks and outside-root entries are refused.
- **Boundary not reached:** match the exact site/operation/occurrence. Inspect event
  sequences. Instrument missing boundaries; do not weaken the assertion to get green.
- **INCONCLUSIVE:** inspect missing terminal/snapshot/boundary evidence. Use
  --fail-on-inconclusive for a CI gate. A request or timeout is not proof of stopping.
- **Oracle mismatch:** compare physical DB writes against effect_committed sequence/IDs.
  Route all fixture commits through ctx.recordEffect. Do not manufacture a PASS.
- **Driver failed with no stack:** arbitrary errors are suppressed to protect secrets.
  Debug trusted synthetic code locally; do not upload private traces.
- **Evidence limit exceeded:** reduce scenario scope/loops; metadata is intentionally
  bounded. Splitting independent scenarios is preferable to raising output limits.
- **Demo reports FAIL but exits 0:** intentional bad controls matched expectations.
  Ordinary run has real CI exit semantics; demo is a diagnostic self-check.
- **All scenarios directory exits 2:** it intentionally includes driver-error.
  Gate a selected passing case or your own regression cases instead.
