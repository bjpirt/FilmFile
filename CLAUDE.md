# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**FilmFile** is a local-first tool for cataloguing film photographs: rolls, frames and multiple versions of each image, organised by roll and by nested events, with metadata as JSON on the filesystem, S3 backup and sync, and workflows that run when things change.

- **Design:** `docs/design.md`; section 13 defines the architecture. Read it before design decisions, and raise any conflict rather than silently diverging. When a design decision is made or changed, update it and remove it from the open questions.
- **Roadmap:** `docs/roadmap.md`, an index of the work still to do grouped by feature in order, then what's for later, the decisions, and what's done; each task's detail and acceptance criteria are in `docs/tasks/<ID>.md`. Work through it in order, build to the acceptance criteria, and keep both true (the `write-task` skill). `docs/plan-phase-0-1.md` was the first plan, with formats, fields and routes in detail.

## Skills

Use the project skills in `.claude/skills/` instead of doing these by hand: `check` (format, verify and journeys, with a short summary), `screenshot`, `add-roll-detail` (the checklist for a new roll detail), `write-task`, `refine-task` (questions about every decision in a task, before it's built), `security-rules` (before touching HTTP, uploads, paths, dependencies or CI) and `testing-conventions` (before writing tests or adding a port).

## How we work: make it work, then make it pretty

- **Working includes tests:** behaviour covered by tests that pass in `pnpm verify`. Test first, from the outside (an endpoint's API test first).
- **Then make it pretty** as separate tasks (right layer, types, error handling, tidying), with the tests green throughout.
- **Don't build ahead:** no abstraction, safeguard or helper before the task that needs it.
- **One task at a time:** finish it, summarise what changed and how to check it, then stop for review. Commit only when asked.

## How we build

Simple first (the design's ports are the only planned abstractions; three similar lines beat a premature helper), legible, tested at the right level, secure by default, and checked by tools in CI. Before adding a dependency, check whether a few lines of our own would do.

## Architecture in brief

- A **backend** (`apps/backend`) owns all archive data and serves the built UI; the browser UI (`apps/web`) is only an API client. No CLI.
- The **desktop app** (`apps/desktop`, Electron) starts the backend in a `utilityProcess` and opens a locked-down window on it (D54); it imports nothing from the backend.
- **Hexagonal**, layers as folders: `domain/` → `application/` (use cases + `ports/`) → `adapters/` (inbound: HTTP; outbound: filesystem, SQLite, sharp, node, memory) → `composition/`, enforced by `eslint-plugin-boundaries`. `domain/` imports nothing outside itself (no I/O, time or randomness); `application/` only `domain/`; only `main.ts` imports `composition/`; `apps/web` only `@filmfile/contracts`.
- **Pure DI:** constructor injection, no container or decorators; adapters built only in `composeLocal` and `composeInMemory`.
- **Three models** mapped explicitly at the adapter: domain types, persistence schemas (filesystem adapter), API contracts (`@filmfile/contracts`).
- Use cases have one `execute(ctx, input)` taking an `ArchiveContext`, returning `Result<T, E>` for expected failures. REST + OpenAPI from Zod; the web UI uses the generated client.

## Invariants — never break these

- The filesystem is the source of truth; SQLite and every other store is a rebuildable cache.
- The service is the only writer. Saves require the expected version token and are atomic, with stable key order so unchanged data is byte-identical.
- Never modify or permanently delete originals (lab scans, raws, editor exports). Versions are only added; the blob store is write-once. Deleting moves files to the archive's `deleted/`, which only the user empties.
- Never write metadata into raws; stamp catalogue metadata into exports only.
- Frame identity lives in `roll.json`. Each version's files sit in `frames/<frame>/<version>/` (last 8 ULID characters), with original names. Renumbering never moves files.
- IDs are ULIDs; never use paths or file names as identity (equipment and events are named by slug, per the design).
- Caches (index, previews, locks) live in the OS cache directory, never in the archive.
- No destructive operation without an explicit request. Do not import NegPy code (GPL-3); reading its formats is fine.

## Code

- Organise by feature within each layer (`domain/rolls/`, `application/use-cases/frames/`, `adapters/inbound/http/routes/rolls.ts`). One main export per file, named after it; files `kebab-case.ts`, types and classes `PascalCase`, functions `camelCase`; use cases verb-first (`CreateFrame`). Named exports only, no barrels.
- Plain functions and data; classes for use cases and adapters. Small functions, early returns. Comments explain why; TSDoc on ports and non-obvious domain functions. Use the domain's language (roll, frame, frame number, version, lab scan).
- **TypeScript:** strict, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (no enums, namespaces or parameter properties). ESM; relative imports name the `.ts` file. No `any`, no `!`, no `as` outside tested boundary code: external data enters as `unknown` and is parsed with Zod. Discriminated unions with exhaustive switches ending in `assertNever`. Branded IDs and domain types for frame numbers. `readonly` by default. Expected failures return `Result`, bugs throw; never swallow errors. No floating promises. Time and IDs only from the `Clock` and `IdGenerator` ports.

## Testing and security, in short

Full rules in the `testing-conventions` and `security-rules` skills.

- Every behaviour has a test at the lowest level that proves it; bug fixes start with a failing test. In-memory adapters and simple fakes, never mocking libraries for our own code; every port has a contract suite run against every adapter. Deterministic, readable, behaviour not implementation. Key journeys in Playwright, written against what a person sees. Coverage floors: 90% for `domain/` and `application/`, 80% overall.
- Treat the localhost service as exposed: Host allow-list and Origin checks, JSON only with its content type, strict security headers, no internals in errors, Zod at every boundary, all paths through the safe-path helper, upload limits checked by signature. Lint rules are not disabled inline without a comment saying why.

## Definition of done

`pnpm verify` passes (the `check` skill); new behaviour is tested; no new dependency without a stated reason; public changes are in the OpenAPI spec (`pnpm generate`) and design changes in `docs/design.md`; the code makes sense to a first-time reader.

## Stack

pnpm workspaces, TypeScript strict, Node LTS (`.nvmrc`). Hono + `@hono/zod-openapi`, Zod, `openapi-typescript` + `openapi-fetch`, sharp, better-sqlite3, ULID, React + Vite + TanStack Query. Vitest, fast-check, Playwright. ESLint (`typescript-eslint`, `eslint-plugin-boundaries`), Prettier. Packages are scoped `@filmfile/*`.
