# Implementation decisions

## Repository and delivery
- Use strict TypeScript, ESM and npm workspaces for core, CLI, driver, fixtures and reports.
- The single root interruptlab package is the consumer artifact. Workspaces remain
  private development modules.
- The candidate version is 0.1.0, distributed as a GitHub source preview. The maintainer
  approved Apache-2.0 and Copyright 2026 Vadim Malkin. npm publication is deferred;
  package metadata remains private.
- Existing configured remote: https://github.com/Olmer1st/InterruptLab.git.
  The maintainer confirmed personal ownership and authorized committing and pushing
  the project to this repository.

## Fixtures and physical observations
- Keep the Round 1 persistent JSONL invoice example as a small smoke fixture.
  The current CLI uses an isolated SQLite oracle by default, with memory fixtures
  available for lightweight callers.
- Use Node 22.22.3's built-in experimental SQLite implementation (SQLite 3.51.3 observed)
  rather than adding a native build dependency. Other runtimes remain untested.
- Compare physical rows against effect_committed IDs and sequences. Disagreement is
  HARNESS_ERROR; missing required observation is INCONCLUSIVE.
- Group effect counts by stable idempotency keys. A resumed attempt may add a tool
  call without adding a physical effect.

## Cancellation and resume
- Use exactly four deterministic injection sites with operation and occurrence selectors.
  Sequence numbers define order; timers bound observation rather than create races.
- Record cancellation request, observation, acknowledgement and terminal evidence
  separately. Completion after cancellation can be permitted by the scenario.
- Resume creates a fresh AbortSignal and context generation. Previous contexts are
  revoked so they cannot write into the resumed attempt.
- Checkpoint receipts are explicit driver contracts, not automatic framework checkpoints.
- Outcome precedence is HARNESS_ERROR > FAIL > INCONCLUSIVE > PASS. Preserve every
  rule result so missing evidence does not hide an observed failed invariant.

## Toolchain and public interfaces
- tsc checks types and emits declarations. Minimal esbuild bundles let the root tarball
  run independently of workspace symlinks.
- Scenarios use a built-in driver or a relative compiled ESM entry exporting createDriver().
  Do not silently introduce a TypeScript execution runtime.
- The initial skeleton driver was extended with ScenarioContext in start/resume;
  [API](api.md) and [CLI](cli.md) document the current provisional v0.1 contracts.

## Security and output
- CLI child workers bound synchronous hangs and leaked handles while suppressing driver
  console output. They are not a security sandbox; execute only trusted code.
- Validate entry containment, schema keys, metadata identifiers and size/deadline limits.
  Entry containment is not transitive import isolation.
- Suppress arbitrary exception text and raw tool payloads. Redact report metadata and
  optional JSONL output; inspect reports before sharing.
- Require a new output directory and atomic per-file writes instead of destructive
  overwrite behavior.
- Security-sensitive paths have explicit failure-path tests. Uninstrumented external
  operations remain outside the fixture oracle's guarantees.

## Documentation alignment
- Use [MVP scope](MVP_SCOPE.md) and [development plan](DEVELOPMENT_PLAN.md) as the
  repository's maintained product and milestone references, aligned with the supplied
  project documents.
- Gate A checks the reproducible duplicate-effect fixture and repaired control.
  [Fixture evidence](fixture-evidence.md) contains executable reproduction instructions.
- Keep validation evidence factual. Keep unverified platform,
  onboarding and release requirements explicit rather than treating them as completed.

## GitHub preview decisions
- Linux is the tested platform; macOS and Windows remain untested.
- Use GitHub private vulnerability reporting without an email reporting address or
  response deadline. The feature is enabled and verified through the repository API.
- Defer private conduct-reporting intake; document that no such channel is available.
