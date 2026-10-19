# Limits and trust
- Only cooperative, instrumented local TypeScript/JavaScript workflows are supported.
- Cancellation intent, observation, acknowledgement and physical stop are distinct.
  Acknowledgement does not roll back a write or stop uninstrumented remote activity.
- The process watchdog is hang containment, not a security sandbox. Trusted drivers
  retain OS privileges; use a separate credential-free container for untrusted code.
- The in-process API cannot interrupt an infinite synchronous loop. CLI isolation can
  terminate its worker, with an INCONCLUSIVE result if no physical evidence survives.
- A resolved driver start alone does not prove termination; observe() must supply it.
  The oracle observes the bundled fixture, not arbitrary production services.
- Resume receipts are explicit driver contracts. They are not framework checkpoint
  validation, durable workflow recovery across OS crashes, or LangGraph integration.
- SQLite fixtures are private disposable local databases; committed effects and call
  counts are transactionally stored. Synthetic idempotency is not remote exactly-once.
- No parallel branch scheduler, HTML viewer, MCP/LangGraph adapter, hosted service,
  model judging, telemetry or external API is included.
- Only Linux / Node 22.22.3 is locally tested. Hosted macOS CI and unfamiliar-developer
  onboarding remain unverified. No real users, adoption or external validation claimed.
- Redaction is bounded defense in depth, not guaranteed recognition of arbitrary secrets.
