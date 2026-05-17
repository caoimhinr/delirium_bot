# REVISION1

## Proposed best-practice changes

### 1. Add centralized configuration validation
- Create a dedicated config module that reads and validates all required environment variables at startup.
- Fail fast if required values such as `DISCORD_TOKEN`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `DISCORD_CLIENT_ID`, or `SESSION_SECRET` are missing.
- Parse numeric values like `MAX_COMPLETION_TOKENS` and `PORT` once instead of relying on implicit string coercion.

**Why:** The current code reads `process.env` in multiple places and does not consistently validate values. This can cause late runtime failures that are harder to diagnose.

### 2. Replace ad-hoc startup wiring with explicit app bootstrap
- Split startup into clear phases: load config, initialize database, start web server, log in Discord client.
- Surface fatal startup failures by exiting the process with a non-zero code.
- Add shutdown handling for SIGINT/SIGTERM so the bot and database pool close cleanly.

**Why:** `index.js` currently coordinates several concerns directly, and startup or shutdown behavior is only partially managed.

### 3. Improve database lifecycle and schema management
- Add connection pool error handling and a `closeDb()` helper in `db.js`.
- Use a migrations approach instead of embedding schema creation directly in application startup.
- Add constraints such as `CHECK (phase > 0)` where appropriate.
- Consider transactions for multi-step claim operations if they grow more complex.

**Why:** Inline schema initialization is convenient early on, but migrations are safer and more maintainable in production.

### 4. Standardize error handling across Discord and Express flows
- Wrap command handlers in a shared error boundary.
- Add Express error-handling middleware for consistent HTTP 500 responses and server-side logging.
- Return user-friendly Discord messages on expected failures and structured logs on unexpected ones.

**Why:** Several async paths catch errors inconsistently, and some failures could be silent or difficult to trace.

### 5. Extract command parsing into a dispatcher
- Replace the large `switch`/`startsWith` chain in `index.js` with a command registry and dispatcher.
- Normalize parsing for command name, args, reply context, and permissions.
- Keep command modules small and isolated.

**Why:** The current message handler works, but it is getting crowded and will become harder to extend safely.

### 6. Remove duplicated LLM calling logic
- Route all model calls through a single LLM client module.
- Reuse shared timeout, retry, logging, and response parsing behavior.
- Move the inline Azure call used by the sweet response into `llm/endpoints.js` or a service wrapper.

**Why:** There is duplicated Azure request logic today, which increases maintenance cost and inconsistency risk.

### 7. Stop logging raw model responses in production
- Remove or gate `console.log('output', JSON.stringify(response.data, null, 2));` behind a debug flag.
- Avoid logging prompt content or full model output unless explicitly enabled.

**Why:** Raw LLM payloads may be noisy, expensive in logs, and may expose user content unnecessarily.

### 8. Add request timeouts, retries, and rate-limit protections for outbound HTTP
- Configure Axios defaults or wrappers for timeout values.
- Add bounded retry behavior for transient failures when calling Steam or Azure endpoints.
- Consider simple rate limiting or queueing for expensive LLM-triggered Discord commands.

**Why:** External API calls are a primary failure surface and currently do not appear to have consistent resilience controls.

### 9. Tighten session and auth security in the web app
- Use a strong required `SESSION_SECRET` in all environments.
- Consider storing sessions in a persistent/shared store instead of in-memory Express sessions for production.
- Review OAuth scopes and keep them minimal.
- Add CSRF protection for maintenance POST routes.
- Add security middleware such as `helmet`.

**Why:** The admin panel performs privileged writes and should follow normal web security hardening practices.

### 10. Validate and sanitize incoming web form data
- Add schema validation for `/maintenance` and `/settings` inputs.
- Enforce length and type constraints for names, descriptions, and phase values.
- Normalize empty strings to `null` consistently.

**Why:** SQL parameterization helps prevent injection, but application-level validation is still needed for correctness and robustness.

### 11. Improve claim flow concurrency and collector handling
- Encapsulate collector setup/cleanup in reusable utilities.
- Ensure all collectors are always cleaned up deterministically.
- Consider one active flow per user globally or per guild depending on desired UX.
- Add better cancellation and timeout messaging.

**Why:** The claim flow is interactive and stateful, so collector leaks or overlapping flows will become a maintenance risk.

### 12. Add structured logging
- Replace bare `console.log`/`console.error` with a logger abstraction.
- Include context such as command name, guild ID, user ID, request path, and error cause.
- Support log levels like debug/info/warn/error.

**Why:** Structured logs make production debugging much easier than scattered console output.

### 13. Add automated tests for core behavior
- Add unit tests for command parsing, prompt building, claim formatting, and service-layer logic.
- Add integration tests for Express routes and database-backed claim flows.
- Mock Discord and Azure dependencies where possible.

**Why:** This project has enough branching logic that regression risk will rise quickly without tests.

### 14. Improve project hygiene and dependency choices
- Remove the `fs` package dependency; Node already provides the built-in `fs` module.
- Add linting and formatting tools such as ESLint and Prettier.
- Add a real `test` script and possibly `dev`/`lint` scripts in `package.json`.

**Why:** These are low-effort improvements that reduce accidental inconsistency and confusion.

### 15. Separate domain logic from transport logic
- Move Discord-specific response formatting out of business logic where practical.
- Keep `claimService` focused on data access and domain operations.
- Introduce service modules for price checking and LLM response generation.

**Why:** Better separation makes the code easier to test and less tightly coupled to Discord or Express.

### 16. Add idempotency and authorization review for admin operations
- Verify that maintenance actions have the right guardrails, confirmations, or audit logging.
- Consider soft deletes or confirmation steps for destructive actions like deleting claims/events.
- Record who changed what in privileged admin flows if this panel is used by multiple operators.

**Why:** Admin tooling tends to grow in importance, and auditability becomes valuable quickly.

## Suggested implementation order
1. Configuration validation
2. Error handling and structured logging
3. LLM client consolidation
4. Command dispatcher refactor
5. Web security hardening
6. Database migrations and lifecycle cleanup
7. Tests, linting, and CI basics

## Quick wins
- Remove the extra `fs` dependency from `package.json`.
- Add Axios timeouts.
- Stop logging full Azure responses.
- Add a shared config module.
- Add `helmet` and CSRF protection to the Express app.
