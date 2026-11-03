---
name: testing-conventions
description: FilmFile's testing rules in full — which level to test at (unit, integration with in-memory adapters and contract suites, API, end to end), fakes instead of mocks, deterministic and readable tests, coverage floors, and what CI and the pre-commit hook run. Use when writing or changing tests, adding a port or adapter, or adding a browser journey.
---

# Testing conventions

Write tests alongside the code, not afterwards. Every bug fix starts with a failing test.

| Level | What | How |
|---|---|---|
| **Unit** | Domain logic: frame numbers, mapping engine, resolver, invariants | Pure functions, table-driven. Property-based tests (`fast-check`) for the mapping engine and resolver, where they earn their keep. |
| **Integration** | Use cases through `composeInMemory`; real adapters against their **port contract suites** | Use cases: in-memory adapters, fixed clock, sequential IDs. Adapters: real filesystem and SQLite in a temp directory per test. Every port has one shared contract suite run against every adapter. |
| **API** | HTTP behaviour | Hono `app.request` against an in-memory composition: status codes, validation errors, ETag/If-Match, uploads, security checks. A snapshot of the generated OpenAPI spec catches accidental contract changes. |
| **End to end** | Key user journeys only, written against what a person sees (roles, labels, text), so they survive refactoring (D22) | Playwright against `composeLocal` with a temp archive and generated fixture scans: first-run setup, import, fix numbering, edit, reload. |

- **Test behaviour, not implementation.** Assert on outcomes (returned results, saved state, HTTP responses), not on which internal functions were called.
- **No mocking libraries for our own code.** Use the in-memory adapters and simple fakes. Mock only third-party edges if unavoidable.
- **Deterministic:** no real time, randomness, sleeps or network. Every test can run alone and in any order.
- **Readable tests:** names describe behaviour ("rejects a save when the roll changed since it was read"). Arrange, act, assert. Small test-data builders (`aRoll().withLabScans(36)`) instead of large literal fixtures.
- **Coverage is a floor, not a target:** 90% lines and branches for `domain/` and `application/`, 80% overall, enforced in CI. Never write tests just to move the number.

## Automated checks

- **`pnpm verify`** runs everything CI runs: format check (Prettier), lint (ESLint with `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked`, plus `eslint-plugin-boundaries`), typecheck (`tsc --noEmit` across the workspace), and unit, integration and API tests with coverage thresholds.
- **CI** runs `pnpm verify`, then the build, Playwright end-to-end tests, the dependency audit, secret scanning and static analysis. CI must pass before merging.
- **Pre-commit hook** (`.githooks/pre-commit`, set up by `pnpm install`) only checks the formatting and lint of staged files, to keep commits fast; it doesn't rewrite them (`pnpm format` does). CI is the real gate.
- Lint rules are not disabled inline without a comment explaining why.
