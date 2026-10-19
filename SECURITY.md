# Security
## Supported scope
This GitHub source preview supports trusted,
cooperative JavaScript/TypeScript drivers on the tested runtime (Node 22.22.3, Linux).
Do not use it for production payments or confidential records.

## Reporting
Security reports are intended to use GitHub private vulnerability reporting.
Configuration is **PENDING_ADMIN_ACTION**: the current authenticated GitHub account
cannot enable the feature. A repository administrator must enable it before the
private reporting link becomes usable. Do not submit sensitive security details in
public issues. No reporting email address or response deadline is provided.

GitHub notification delivery is controlled by the maintainer's personal GitHub settings;
this project does not request email reports.

## Trust and isolation
Drivers are executable code with the current user's filesystem/network privileges.
CLI child workers strip inherited environment variables, suppress driver stdout/stderr
and are killed on deadline. These measures prevent common leaks and hangs; they are
not a security sandbox. Use an isolated container without credentials for untrusted code.
Do not give drivers real credentials. No remote effects, network calls, model service,
telemetry or API keys are needed by bundled scenarios.

## Data and limits
Reports contain bounded identifiers, effect metadata and rule outcomes, never raw tool
arguments or exception stacks. Default credential-shape/key redaction is defense in depth;
it cannot recognize every secret. Inspect reports before sharing.
Scenario files: 64 KiB, at most 64 files, directory depth 4, YAML aliases capped at 20.
Run events and effects: 10,000 each. CLI result: 128 KiB; oversized evidence becomes a
harness error. Imported reports: 16 MiB. New output directories avoid overwriting results.
SQLite databases live in private temporary directories and are deleted after worker exit.

## Review
npm run security:scan performs a deliberately limited credential-pattern scan across
working files, generated artifacts and genuine Git history. It is not a comprehensive
security audit. npm audit assesses locked dependency advisories. No history rewrites,
credential revocations or publication have been performed.
