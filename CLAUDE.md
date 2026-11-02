# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**FilmFile** is a local-first tool for cataloguing film photographs: rolls, frames and multiple versions of each image, organised by roll and by nested events, with metadata as JSON on the filesystem, S3 backup and sync, and workflows that run when things change.

- **Design:** `docs/design.md`. Section 13 defines the architecture. Read it before making design decisions; if a task conflicts with it, raise it rather than silently diverging.
- **Current plan:** `docs/plan-phase-0-1.md` (what and why), broken into ordered, commit-sized tasks in `docs/tasks-phase-0-1.md`. Work through the tasks in order, tick them off there, and check each step's "done when" criteria.

## How we work: make it work, then make it pretty

Working always includes tests.

- **Make it work first.** Get the smallest end-to-end version of a feature running before improving it. "Working" means its behaviour is covered by tests that pass in `pnpm verify`, not just that it runs.
- **Test first, from the outside.** For an endpoint, write the API test first, then the simplest code that passes it.
- **Then make it pretty**, as separate tasks: move logic into the right layer, add types, error handling and safeguards, tidy up. The tests stay green throughout, which is what makes the changes safe.
- **Don't build ahead.** No abstraction, safeguard or helper before the task that needs it, even where the rules below describe it as the end state. The task list says when each one arrives.
- **One task at a time.** Finish a task, summarise what changed and how to check it, then stop for review. Commit only when asked.

In the current plan, milestones S1 and S2 are "make it work" for rolls and scans (API, then a basic UI), and milestone H is "make it pretty". During S1 and S2, routes may do file I/O directly, and security middleware, atomic writes, version tokens and contract suites wait for their H task.

## How we build: lightweight, legible, well tested, secure

These describe where the code ends up; "How we work" above sets the order in which it gets there.

1. **Simple first.** Build what the current plan step needs, nothing speculative. The ports in the design are the only planned abstractions; don't add generic base classes, frameworks, factories or config options "for later". Three similar lines beat a premature helper.
2. **Legible.** Code is read far more than written. Clear names, small focused modules, obvious flow. A newcomer should understand a file without reading the rest of the codebase.
3. **Tested at the right level.** Every behaviour has a test; most tests are fast and run without disk or network.
4. **Secure by default**, even though it runs locally with no login (see Security).
5. **Automated quality gates.** If a rule matters, a tool checks it in CI.

Before adding a dependency, check whether a few lines of our own code would do. Every dependency is attack surface and upkeep.

## Architecture in brief

- A **backend** (`apps/backend`), the core API service, owns all archive data and also serves the built UI. The browser UI (`apps/web`) is only a client of the API. There is no CLI.
- **Hexagonal architecture.** Layers are folders in the service: `domain/` → `application/` (use cases + `ports/`) → `adapters/` (inbound: HTTP, watcher; outbound: filesystem, SQLite, sharp, node, SSE, memory) → `composition/`. `eslint-plugin-boundaries` enforces import direction:
  - `domain/` imports nothing outside itself. No I/O, time or randomness.
  - `application/` imports only `domain/`.
  - Only `main.ts` imports `composition/`.
  - `apps/web` imports only `@filmfile/contracts`.
- **Pure DI.** Constructor injection, no container library, no decorators. Adapters are only constructed in composition roots (`composeLocal`, `composeInMemory`).
- **Three models:** domain types, persistence schemas (filesystem adapter), API contracts (`@filmfile/contracts`). Map explicitly at the adapter.
- Use cases have one `execute(ctx, input)` method, take an `ArchiveContext`, and return `Result<T, E>` for expected failures.
- REST + OpenAPI generated from Zod; the web UI uses the generated typed client.

## Invariants — never break these

- The filesystem is the source of truth. SQLite and every other store is a rebuildable cache.
- The service is the only writer. Repository saves require the expected version token and are atomic, with stable key order so unchanged data is byte-identical.
- Never modify or permanently delete original files (lab scans, raws, editor exports). Versions are only ever added; the blob store is write-once. Deleting a frame or roll moves its files into the archive's `deleted/` holding area, which only the user empties.
- Never write metadata into raws. Stamp catalogue metadata into exports only.
- Frame identity lives in `roll.json`. Each version's files sit in its own folder, `frames/<frame>/<version>/`, named by the last 8 characters of the ULIDs, and keep their original names. Renumbering never moves files.
- IDs are ULIDs. Never use paths or file names as identity.
- Caches (index, previews, lock files) live in the OS cache directory, never in the archive.
- No destructive operation without an explicit request.
- Do not import NegPy code (GPL-3). Reading its file formats is fine.

## Code organisation and style

- **Organise by feature within each layer:** `domain/rolls/`, `domain/mapping/`, `application/use-cases/frames/`, `adapters/inbound/http/routes/rolls.ts`. Related code sits together.
- **One main export per file**, named after the file. Files `kebab-case.ts`; types and classes `PascalCase`; functions and variables `camelCase`. Use cases are named verb-first: `CreateFrame`, `UpdateFrame`.
- **Named exports only**; no default exports, no barrel files that re-export everything.
- **Prefer plain functions and data.** Use classes for use cases and adapters, where constructor injection is the point.
- **Small functions** that do one thing; extract when a block needs a comment to explain *what* it does. Early returns over nested conditionals.
- **Comments explain why**, not what. TSDoc on port interfaces and on non-obvious domain functions (the mapping engine, the resolver).
- **Name things in the domain's language:** roll, frame, frame number, anchor, version, lab scan. See the glossary in the design doc.

## TypeScript rules

- `tsconfig` is strict, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (so no enums, namespaces or constructor parameter properties; declare injected dependencies as fields). ESM throughout; relative imports name the `.ts` file (`import { ok } from './result.ts'`), so Node can run the source directly.
- **No `any`.** External data enters as `unknown` and is parsed with Zod at the boundary (HTTP request, file read, config). Inside the core, types are trusted.
- **No non-null assertions (`!`)**, and no type assertions (`as`) outside tested boundary code.
- **Model states with discriminated unions** and handle them with exhaustive `switch` statements ending in an `assertNever`.
- **Branded IDs** (`RollId`, `FrameId`, `VersionId`, `ArchiveId`) so they can't be mixed up. Frame numbers are a domain type, not raw strings.
- **No enums**; use string literal unions or `as const` objects.
- **`readonly` by default** for domain data; return new values rather than mutating arguments.
- **Expected failures return `Result`; bugs throw.** Never use exceptions for control flow, never swallow errors, never `catch` without handling or rethrowing.
- **No floating promises**; every promise is awaited or explicitly handled.
- **Time and IDs only come from the `Clock` and `IdGenerator` ports**, never `Date.now()` or `new Date()` in the core.

## Testing

Write tests alongside the code, not afterwards. Every bug fix starts with a failing test.

| Level | What | How |
|---|---|---|
| **Unit** | Domain logic: frame numbers, mapping engine, resolver, invariants | Pure functions, table-driven. Property-based tests (`fast-check`) for the mapping engine and resolver, where they earn their keep. |
| **Integration** | Use cases through `composeInMemory`; real adapters against their **port contract suites** | Use cases: in-memory adapters, fixed clock, sequential IDs. Adapters: real filesystem and SQLite in a temp directory per test. Every port has one shared contract suite run against every adapter. |
| **API** | HTTP behaviour | Hono `app.request` against an in-memory composition: status codes, validation errors, ETag/If-Match, uploads, security checks. A snapshot of the generated OpenAPI spec catches accidental contract changes. |
| **End to end** | Critical user journeys only | Playwright against `composeLocal` with a temp archive and generated fixture scans: first-run setup, import, fix numbering, edit, reload. |

- **Test behaviour, not implementation.** Assert on outcomes (returned results, saved state, HTTP responses), not on which internal functions were called.
- **No mocking libraries for our own code.** Use the in-memory adapters and simple fakes. Mock only third-party edges if unavoidable.
- **Deterministic:** no real time, randomness, sleeps or network. Every test can run alone and in any order.
- **Readable tests:** names describe behaviour ("rejects a save when the roll changed since it was read"). Arrange, act, assert. Small test-data builders (`aRoll().withLabScans(36)`) instead of large literal fixtures.
- **Coverage is a floor, not a target:** 90% lines and branches for `domain/` and `application/`, 80% overall, enforced in CI. Never write tests just to move the number.

## Security

FilmFile runs on localhost without login, but **any website the user visits can try to talk to it**, and it handles uploaded files. Treat it as exposed.

**Threats we design against:** malicious web pages reaching the local API (cross-site request forgery, DNS rebinding); crafted uploads and crafted JSON; path traversal into the filesystem; supply-chain attacks through dependencies and CI; and a later move to cloud hosting.

**Request handling (HTTP adapter)**

- Bind to `127.0.0.1` only.
- **Host allow-list:** reject (403) any request whose `Host` isn't `localhost`, `127.0.0.1` or `[::1]` on the configured port. This defeats DNS rebinding.
- **Origin check:** reject (403) any request carrying an `Origin` other than the UI's own origin. State-changing requests must have a matching `Origin`. No permissive CORS, never `*`.
- **JSON bodies require `Content-Type: application/json`**, so cross-site forms can't send them.
- Don't rely on browser protections such as Chrome's Local Network Access prompt; not every browser has them.
- Security headers on every response: a strict Content Security Policy (`default-src 'self'`), `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`.
- Error responses never include stack traces, file paths or internal details; log them server-side with a correlation ID.

**Input and files**

- Validate every input with Zod at the boundary, including path parameters, query strings and headers. Roll numbers, file names and lab patterns have strict formats.
- **Never build filesystem paths from user input directly.** Resolve every path through one helper that rejects absolute paths, `..`, separators in names, and anything that resolves outside the archive or cache root.
- **Uploads:** maximum file size, an allow-list of image types checked by file signature (magic bytes) rather than extension, and sharp's input pixel limit.
- Responses expose DTOs only, never internal objects or absolute paths.

**Dependencies and CI (supply chain)**

- pnpm with a committed lockfile; CI installs with `--frozen-lockfile`.
- In `pnpm-workspace.yaml`: `minimumReleaseAge` of at least 3 days, `allowBuilds` listing only packages that genuinely need install scripts (e.g. `sharp`, `better-sqlite3`, `esbuild`), `strictDepBuilds: true`, `blockExoticSubdeps: true`, `trustPolicy: no-downgrade`.
- `pnpm audit --audit-level high` (or OSV-Scanner) in CI, and Dependabot or Renovate for updates.
- GitHub Actions pinned to full commit SHAs, with `permissions: contents: read` by default.
- Secret scanning (gitleaks) in CI. No secrets in the repo; configuration comes from environment variables or a local, git-ignored config file. Future AWS access uses named profiles or OIDC, never committed keys.
- Static analysis: CodeQL if the repository is public, otherwise Semgrep's free rules.

**Security tests** are part of the API suite: wrong `Host`, foreign `Origin`, missing content type, path traversal attempts, oversized and disguised uploads.

## Automated checks

- **`pnpm verify`** runs everything CI runs: format check (Prettier), lint (ESLint with `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked`, plus `eslint-plugin-boundaries`), typecheck (`tsc --noEmit` across the workspace), and unit, integration and API tests with coverage thresholds.
- **CI** runs `pnpm verify`, then the build, Playwright end-to-end tests, the dependency audit, secret scanning and static analysis. CI must pass before merging.
- **Pre-commit hook** (`.githooks/pre-commit`, set up by `pnpm install`) only checks the formatting and lint of staged files, to keep commits fast; it doesn't rewrite them (`pnpm format` does). CI is the real gate.
- Lint rules are not disabled inline without a comment explaining why.

## Definition of done for any change

- `pnpm verify` passes locally.
- New behaviour has tests at the lowest level that proves it; bug fixes have a regression test.
- No new dependency without a reason stated in the commit message or PR.
- Public behaviour changes are reflected in the OpenAPI spec, and design changes in `docs/design.md`.
- The code would make sense to someone reading it for the first time.

## Stack

pnpm workspaces, TypeScript strict, Node LTS. Hono + `@hono/zod-openapi`, Zod, `openapi-typescript` + `openapi-fetch`, `sharp`, `better-sqlite3`, `chokidar`, ULID, React + Vite + TanStack Query. Vitest, `fast-check`, Playwright. ESLint (`typescript-eslint`, `eslint-plugin-boundaries`), Prettier. Packages are scoped `@filmfile/*`.

## Working conventions

- When a design decision is made or changed, update `docs/design.md` and remove it from the open questions.
