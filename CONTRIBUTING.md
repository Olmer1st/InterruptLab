# Contributing
Use Node 22.22.3 and npm 11.12.1. Run npm ci, npm run build, npm run typecheck,
npm run lint, npm test, npm run demo and npm run pack:check at the repository root.

Discuss large features before implementation. For bugs, provide a minimal synthetic
scenario, expected versus observed rules, Node/OS versions and event sequences.
Never include credentials, personal data or raw confidential traces. See SECURITY.md;
use the GitHub private vulnerability reporting link in SECURITY.md.

Use strict TypeScript and ESM. Reuse existing schema, store, recorder, assertion and
report utilities. Tests must cover a failure path, a passing control and missing
evidence when relevant. Race scheduling uses named barriers; timers only bound hangs.
Do not retry a failing case to manufacture green. Run targeted tests first, then the
baseline checks. Update API/CLI docs, CHANGELOG and decisions for behavior changes.

Build outputs under dist and workspace dist directories are generated; do not edit
them manually. The single root package is packed for consumers; workspaces are private
development modules. Verify installed runtime exports and declarations after changes.
Keep authentic Git history; never overwrite unrelated manually authored patches.

The maintainer controls review, merge, licensing and releases. No CLA/DCO or ownership
assignment has been adopted. Contributions are made under Apache-2.0; see LICENSE and NOTICE.
Do not push, publish, tag, change legal ownership or rewrite shared history automatically.
