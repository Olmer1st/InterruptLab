# Changelog
## Unreleased — proposed 0.1.0
- Adopt Apache-2.0 and the maintainer-approved copyright notice for a GitHub source
  preview. Keep npm publishing private and document the selected reporting policy.
- Align product scope, milestone gates, testing and fixture reproduction docs
  with the current development plan.
- Add strict TypeScript ESM npm workspace scaffold and the original resume spike.
- Add runScenario, ScenarioContext, cooperative driver contracts and four deterministic
  cancellation boundaries with explicit observation/acknowledgement events.
- Add per-run, per-step and cancellation-grace deadlines, revoked contexts and
  child-process watchdogs. Resume receives a fresh signal and execution context.
- Add transactional SQLite and memory fixture effects, stable idempotency keys,
  physical call counts, snapshot consistency checks and six invariant families.
- Add eight offline packs, repeated negative controls and incomplete-evidence outcomes.
- Add YAML/JSON validation, init/run/demo/report CLI, terminal/JSON/JUnit/Markdown
  reports and redacted JSONL events, strict exit codes and collision-safe output.
- Add consumer integration, CI matrix, packaging/type checks, security/support/conduct
  documentation and a release-readiness checklist.

### Contract changes from Round 1
The skeleton driver now receives ScenarioContext in start/resume. Scenario inputs are
strict version-one documents with exactly one CLI driver/entry selector. Root package
exports and the CLI are packaged as one candidate, rather than separately publishing
private workspaces. The R1 fake JSONL invoice spike remains as a smoke example; the
current CLI uses a real SQLite oracle by default.

No versioned release, npm publication or external pilot is claimed.
