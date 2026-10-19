# Proposed v0.1.0 release notes
InterruptLab provides a local instrumented-workflow cancellation and resume harness:
four deterministic injection boundaries, explicit cooperative lifecycle evidence,
SQLite/memory physical effects, conservative invariant outcomes, eight synthetic
packs and CLI reports for local development and CI.

Use the README quickstart. No API key or model is needed. The intentional bad demos
show duplicate writes, acknowledged cancellation followed by a forbidden write, and
missing evidence; the fixed controls demonstrate safe synthetic behavior.

The API and schema are provisional before 1.0. Root exports replace the R1 skeleton
contracts. Cancellation never implies remote rollback or universal process stopping.
Read docs/limitations.md before adapting real application code.

These are candidate notes for a GitHub source preview under Apache-2.0. Linux is tested;
macOS and Windows are untested. GitHub private security reporting requires administrator
enablement. Private conduct reporting and npm publication are deferred. Onboarding trials
remain unverified; no supported versioned release or npm publication is claimed.
