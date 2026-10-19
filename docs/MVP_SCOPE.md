# InterruptLab MVP scope

Defines the product behavior and acceptance requirements for the local v0.1 candidate.
This page describes product scope; [API](api.md), [CLI](cli.md) and
[release readiness](release-readiness.md) document the implemented candidate and evidence.

## Purpose and audience
InterruptLab is a local TypeScript regression harness for developers building asynchronous
workflows, approval flows and agent applications. It checks what happens when a workflow
is canceled or resumed: whether cancellation reaches instrumented work, whether terminal
state is observed, and whether committed effects repeat.

The primary delivery is a Node.js CLI, TypeScript API, synthetic fixtures and CI-ready
reports. Core examples run without accounts, API keys, hosted models or network services.

## Required semantics
- Observe actual fixture effects rather than accepting a workflow's final message.
- Distinguish cancel_requested, cancel_observed, cancel_acknowledged and terminal evidence.
- Request cooperative cancellation through AbortSignal and driver instrumentation.
- Never infer rollback or physical stopping from an acknowledged cancellation request.
- Use deterministic named barriers; sequence numbers define execution order.
- Return INCONCLUSIVE when required boundary, terminal or physical-state evidence is missing.
- Allow completion after cancellation when the declared contract permits it.
- Keep runs reproducible using scenario identity, seed, version/environment metadata,
  initial fixture hash, physical rows, event ledger and a rerun command.

## P0 deliverables
| Area | Required behavior |
| --- | --- |
| API | runScenario, ScenarioContext and step/checkpoint/cancel/effect/observation primitives |
| Drivers | Cooperative instrumented TypeScript/JavaScript workflows; explicit resume receipt |
| Injection | before-step, after-step-start, before-effect-commit, after-effect-commit-before-response |
| Scenarios | Strict version-one YAML/JSON with selectors, deadlines and declared assertions |
| Physical effects | Isolated SQLite and memory stores; IDs, logical/idempotency keys, committed flag, ordering and call counts |
| Evidence | Monotonic event sequences, checkpoint and terminal observations, snapshot/ledger consistency |
| Rules | Effect cardinality, forbidden late commits, cancellation propagation, terminal state, required observation and checkpoint consistency |
| Outcomes | PASS, FAIL, INCONCLUSIVE, HARNESS_ERROR with per-rule evidence |
| CLI | init, run, demo, report |
| Reports | Terminal, JSON, JUnit XML and Markdown; bounded and redacted by default |
| Fixtures | Six to eight synthetic passing, failing and missing-observation controls |
| Onboarding | Reproducible quickstart, API/CLI reference, CI example and contributor guidance |

The implemented root package is interruptlab, with private development workspaces.
TypeScript driver modules must be compiled to ESM JavaScript before CLI loading.

## Required scenarios
1. Cooperative slow task: request cancellation, observe it and obtain terminal evidence.
2. Noncooperative task: bound observation and retain an unknown outcome when stopping
   cannot be established.
3. Committed invoice with lost result: unsafe resume creates two physical effects.
4. Idempotent resume: the same logical key creates one physical effect across two calls.
5. Approval pause/resume: earlier effects remain coherent.
6. Missing observer: required effect cardinality cannot pass.
7. Executable/configuration failure: report a harness error with safe diagnostics.
8. Forbidden late commit: fail only when a declared barrier contract forbids the write.

[Fixture evidence](fixture-evidence.md) provides runnable commands and expected outcomes.

## Validation gates
- **Gate A:** consistently reproduce a duplicate effect, explain the cancellation sequence,
  and obtain PASS after repairing the synthetic workflow.
- **Gate B:** buggy FAIL and fixed PASS across at least ten independent runs with coherent
  physical state and no retry-to-green.
- **Gate C:** two unfamiliar developers can integrate a small workflow using documentation;
  the under-30-minute target remains unvalidated until those trials occur.

The local engineering milestones are implemented. Public release depends on the
remaining checks in [release readiness](release-readiness.md).

## Quality and safety
Use synthetic data, private temporary SQLite databases and no telemetry by default.
Execute only trusted drivers; process isolation is a watchdog, not a security sandbox.
Bound run, step and observation time; reject unsafe paths, malformed configuration,
oversized evidence and output collisions. Do not persist raw payloads or arbitrary errors.
Label platforms and validation not actually tested.

Locally tested environment: Linux, Node 22.22.3, npm 11.12.1.
macOS is a CI target with hosted results unverified; Windows is untested.
Ninety-percent core branch coverage and an eight-case demo under 30 seconds are
quality targets, not assumed achievements. See [testing](testing.md) for recorded local evidence.

## Deferred beyond v0.1
LangGraph JS/MCP adapters, parallel branch scheduling and an optional HTML timeline
require separate integration work. Arbitrary process attachment, remote-effect rollback,
production approval/payment enforcement, hosted services and multilingual drivers are
outside the MVP. Framework adapters must preserve explicit observation limits.

## Community and release
Keep a working README, contribution guide, support boundaries, conduct policy, security
policy, issue/PR templates, roadmap and changelog. Use the approved Apache-2.0 license. The GitHub source preview is authorized; npm
publication remains deferred. GitHub private security reporting is enabled and
verified; private conduct reporting is deferred.
Keep local engineering progress separate from these publication decisions.
