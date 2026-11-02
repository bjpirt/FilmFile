# FilmFile tasks: Phase 0 and Phase 1

*Created 2 November 2026 from `docs/plan-phase-0-1.md`. The plan says what and why; this file is the ordered list of work. Tick tasks off here as they're done.*

Each task is about one commit: small enough to review in one sitting, with its tests in the same commit. `pnpm verify` passes at the end of every task (from task 0.1.4 onwards). Task IDs follow the plan's step numbers, so `0.4.3` is the third task of plan step 0.4.

Where this list orders things differently from the plan, it says why. Persistence formats, field rules and the route list are not repeated here; see the plan.

---

## Decisions

Settled on 2 November 2026 and recorded in `docs/design.md`. Tasks refer to them by number.

| # | Decision | Affects |
| --- | --- | --- |
| D1 | The service serves the built UI at `/`, so UI and API share one origin. In development, Vite proxies `/api` to the service, and the allowed UI origin is set to the Vite dev server's through configuration. | 0.6.2, 1b.1 |
| D2 | The API docs page's assets are served by the service itself, not a CDN, so the CSP needs no exceptions. | 0.2.6 |
| D3 | No per-format "above the last frame" warning. Mapping warnings are duplicate numbers and below `00` only. | 1.1.4 |
| D4 | Lab scan uploads are limited to 200 MB per file, checked while streaming. | 1.3.6, 1.4.4 |
| D5 | *Superseded by D11:* there are no import sessions or staging. | |
| D6 | Unconfirmed numbering is shown with a badge on the roll only; frame numbers look normal. | 1b.6 |
| D7 | Roll IDs are `YYYY-NNN` (e.g. `2026-014`), stored under `rolls/YYYY/YYYY-NNN/`. `YYYY` is the year shot; `NNN` is the next free number in that year when catalogued. No other formats. | 1.1.1, 1.2.1 |
| D8 | The API never invents a roll ID; `CreateRoll` requires one. The UI suggests the next free number for a year, worked out from the roll list, but the field starts empty. | 1.3.3, 1b.3 |
| D9 | Roll lists sort by roll ID by default, or by shot date when chosen. Roll shot dates are optional. | 1.2.4, 1.3.4, 1b.6 |
| D10 | A roll ID can be changed only by an explicit rename, which moves the roll's folder. The ULID is unchanged. | 0.4.1, 1.3.15, 1c.2 |
| D11 | The API has no import workflow. A roll is created first, then each frame is created and its lab scan uploaded as a version (D13); the UI drives the import. Edge numbers are optional on creation and can be set later. Creating a frame is an append that doesn't need `If-Match`; a scan whose hash is already in the roll returns 409, so retries are safe. Frames can be added to a roll that already has frames. | 1.3.6, 1.4.4, 1b.3–1b.5 |
| D12 | Frames can be deleted, and rolls can be deleted when they have no frames, as explicit, confirmed actions. Nothing is permanently deleted: deleted items move into `deleted/` in the archive, one dated folder each with the files and their JSON, and only the user empties it. No restore in the UI in Phase 1. | 0.4.1, 1.2.3, 1.3.16, 1c.2, 1c.3 |
| D13 | Image data and metadata have separate endpoints. Frames are JSON; images are uploaded as versions of a frame (`POST …/frames/{frameId}/versions?kind=…`, raw body). Versions have ULIDs; `defaultVersion` and `parents` refer to version IDs, never paths. Phase 1 accepts only `kind=lab-scan`. A frame with no versions is valid. `defaultVersion` is optional; when unset the newest version is shown. A single version can be deleted into the holding area. Originals are read by version ID. | 1.1.1, 1.1.7, 1.3.6, 1.3.11, 1.3.16, 1.4.3–1.4.6, 1b.4, 1b.7, 1b.8 |
| D14 | No "preview" version kind: kind is where a file came from, not what it's for. On-screen images are generated previews of the frame's shown version, cached outside the archive. Every version records `width` and `height`, read by the `ImageInspector` port at upload. | 1.1.1, 1.2.7, 1.3.6 |
| D15 | A frame's `defaultVersion` (optional version ID) is the version the UI shows; when unset, the newest version is shown. It lives on the frame rather than as a flag on versions, so there can only be one. Set from the frame view. | 1.1.1, 1.1.7, 1b.8 |

**Still open** (in `docs/design.md`, section 15): where the mapping engine lives (service endpoint, shared package or UI), and whether `roll.json` keeps the mapping used. Tasks that depend on it are marked *(blocked: mapping location)*.

---

## Phase 0: Foundations

### 0.1 Repository and tooling

- [x] **0.1.1 Initialise the repository.** `git init`, `.gitignore` (node_modules, build output, coverage, local config), `.editorconfig`, `.nvmrc` with the current Node LTS.
- [x] **0.1.2 pnpm workspace.** Root `package.json` (`engines`, `packageManager`), `pnpm-workspace.yaml` listing `apps/*` and `packages/*`, with the supply-chain settings from CLAUDE.md (`minimumReleaseAge`, `allowBuilds`, `strictDepBuilds`, `blockExoticSubdeps`) from the start rather than in 0.6, so no dependency is ever installed without them. Empty packages `@filmfile/service`, `@filmfile/web` and `@filmfile/contracts`.
- [x] **0.1.3 TypeScript.** `tsconfig.base.json` with strict plus the extra flags in CLAUDE.md; a `tsconfig.json` per package extending it; a root `typecheck` script running `tsc --noEmit` in every package.
- [x] **0.1.4 Prettier, ESLint and Vitest.** Prettier config and `format:check`. ESLint flat config with `strictTypeChecked` and `stylisticTypeChecked`, plus rules for: no default exports, no enums (`no-restricted-syntax`), no non-null assertions, no floating promises. Vitest workspace config with coverage thresholds (90% lines and branches for `domain/` and `application/`, 80% overall). Root `pnpm verify` runs format check, lint, typecheck and tests.
- [ ] **0.1.5 Layer boundaries.** `eslint-plugin-boundaries` with the element types `domain`, `application`, `adapters`, `composition`, `main` and the rules from the plan. Add a lint fixture or test proving that a `domain` file importing an adapter fails lint, and that `apps/web` importing from `apps/service` fails.
- [ ] **0.1.6 Minimal CI.** A GitHub Actions workflow with actions pinned to commit SHAs and `permissions: contents: read`: frozen-lockfile install and `pnpm verify`. (The plan's 0.1 is only done when CI passes, so a basic pipeline belongs here; 0.6 adds the rest.)

**Done when:** CI passes on the skeleton, and the wrong-way import in 0.1.5 fails the build.

### 0.2 Service skeleton and composition

- [ ] **0.2.1 `Result`.** `domain/shared/result.ts`: the `Result<T, E>` type, `ok`, `err`, and only the helpers the next tasks actually use. Plus `assertNever`.
- [ ] **0.2.2 Domain errors.** A discriminated union of `NotFound`, `ValidationFailed`, `ConcurrencyConflict`, `AlreadyExists` and `MappingInvalid`, each with the fields the HTTP layer needs to build a safe message.
- [ ] **0.2.3 IDs and context.** Branded `ArchiveId`, `RollId`, `FrameId` and `VersionId` with parse functions; `ArchiveContext`.
- [ ] **0.2.4 `Clock` and `IdGenerator` ports.** Port interfaces with TSDoc; node adapters (system time, ULID); a fixed clock and a sequential ID generator for tests. A shared contract suite for each port (for example, IDs are unique and valid ULIDs).
- [ ] **0.2.5 Composition roots.** `composeInMemory()` and `composeLocal(config)` returning `{ application, httpApp }`. A config schema (Zod) for archive path, cache directory, host and port; `main.ts` parses config from the environment and starts the server on `127.0.0.1`.
- [ ] **0.2.6 Health and OpenAPI.** `GET /api/health`, `GET /api/openapi.json`, and the docs page at `/api/docs` (assets served locally, per D2). API tests against `composeInMemory`, and one test that starts `composeLocal` against a temp directory.

**Done when:** `GET /api/health` responds from both compositions, and the docs page loads.

### 0.3 Contracts package

- [ ] **0.3.1 Schemas.** `@filmfile/contracts` with Zod schemas for health and archive DTOs, which the service's routes use.
- [ ] **0.3.2 Spec and client generation.** A script that writes the OpenAPI spec from the service's route definitions into the contracts package, runs `openapi-typescript`, and exports an `openapi-fetch` client factory. A check in `pnpm verify` that fails if the committed spec or generated types are out of date.
- [ ] **0.3.3 OpenAPI snapshot test.** Snapshot the generated spec, so any contract change shows up in review.
- [ ] **0.3.4 Web app shell.** A Vite + React app in `apps/web` that calls the health endpoint through the generated client and shows the result. A test that it renders the health status.

**Done when:** the web app makes a typed call to the health endpoint.

### 0.6a Safe paths and HTTP security (brought forward)

The plan puts this in 0.6. The safe path helper is needed before the filesystem adapters in 0.4, and the security middleware is cheapest to add before more routes exist, so both move up.

- [ ] **0.6.1 Safe path helper.** `adapters/driven/filesystem/safe-path.ts`: resolves a relative path against a root, rejecting absolute paths, `..` segments, separators inside a single name, null bytes, and anything that resolves outside the root, including through symlinks. Table-driven tests with traversal attempts.
- [ ] **0.6.2 Host and Origin checks.** Middleware rejecting (403) a `Host` that isn't `localhost`, `127.0.0.1` or `[::1]` on the configured port, and any `Origin` other than the configured UI origin (D1). State-changing methods require a matching `Origin`. API tests for each case.
- [ ] **0.6.3 Content type and security headers.** Requests with a JSON body require `Content-Type: application/json` (415 otherwise). Every response gets the CSP, `X-Content-Type-Options`, `frame-ancestors 'none'` and `Referrer-Policy` headers. API tests.
- [ ] **0.6.4 Error handler.** Unexpected errors return a generic 500 with a correlation ID and are logged server-side with that ID. A test proving that no stack trace or path appears in the response body.

### 0.4 Repository ports and adapters

- [ ] **0.4.1 Repository port interfaces.** `ArchiveRepository`, `RollRepository` and `EquipmentRepository` in `application/ports/`, with the `{ value, version }` read shape, `create` returning `AlreadyExists`, and `save(ctx, value, expectedVersion)` returning `ConcurrencyConflict`. `RollRepository.rename(ctx, id, newRollId, expectedVersion)` returns `AlreadyExists` or `ConcurrencyConflict` (D10). `RollRepository.delete(ctx, id, expectedVersion)` for empty rolls, which hands the folder to the holding area (D12). TSDoc on each. Only the minimum domain types needed to compile (fleshed out in 1.1).
- [ ] **0.4.2 Contract suites.** One shared suite per port in `test/contracts/`, taking a factory for the adapter under test: create, read, not found, already exists, save with the current version, save with a stale version, rename to a free ID, rename to a taken ID.
- [ ] **0.4.3 In-memory adapters.** All three, passing the contract suites.
- [ ] **0.4.4 Persistence schemas.** Zod schemas for `archive.json`, `roll.json` and the equipment files (formats in the plan), with `schema: 1` and an empty migration registry. Explicit mapping functions between persistence and domain types.
- [ ] **0.4.5 Stable serialisation.** A serialiser with fixed key order, 2-space indent and a trailing newline. A property test that serialise → parse → serialise is byte-identical.
- [ ] **0.4.6 Atomic writer.** A per-file lock (lock files in the cache directory), a version check (version = SHA-256 of the file bytes), and a write to a temp file in the same directory, fsync, then rename. Tests: concurrent saves serialise; a simulated crash between the temp write and the rename leaves the original intact.
- [ ] **0.4.7 Filesystem adapters.** The three repositories on top of 0.4.4 to 0.4.6, every path going through the safe path helper. Invalid files return a typed error naming the file and field. Rename moves the roll folder with a single directory rename, creating the year folder if needed. Run the contract suites against them in a temp directory per test, plus a test that a failed rename leaves the original folder intact.

**Done when:** the contract suites pass for both adapters, including stale versions, serialised concurrent saves, crash safety and byte-stable round trips.

### 0.5 Fixtures

- [ ] **0.5.1 Test-data builders.** `aRoll()`, `aFrame()` and `anArchive()` with fluent `with…` methods, in the test folder of `apps/service`.
- [ ] **0.5.2 Temp archive helper.** Creates a temp archive and cache directory per test and removes them afterwards.
- [ ] **0.5.3 Lab scan generator.** A sharp script that creates small JPEGs named `BBBBNNNN.jpg`, each with its edge number drawn on it.
- [ ] **0.5.4 Fixture sets.** Head to tail, tail to head, a lab-skipped frame, starting at `00`, and one containing `12A`. Generated deterministically, so they can be rebuilt rather than committed if preferred.

### 0.6b Quality baseline (rest of 0.6)

- [ ] **0.6.5 Full CI pipeline.** Add the build, Playwright (an empty smoke test for now), `pnpm audit --audit-level high`, gitleaks, and CodeQL or Semgrep depending on whether the repository is public. Add a macOS job, because `sharp` is a known install risk.
- [ ] **0.6.6 Dependency updates.** Dependabot or Renovate, including GitHub Actions SHAs.
- [ ] **0.6.7 Pre-commit hook.** lint-staged formats and lints staged files only.

**Done when:** API tests prove that a wrong `Host`, a foreign `Origin` and a missing content type are rejected with 403/415, the path traversal tests pass, and the full CI pipeline is green.

---

## Phase 1, milestone 1a: Domain, use cases and API

### 1.1 Domain

- [ ] **1.1.1 Domain types.** `Archive`, `Roll`, `Frame`, `Version`, `Meta`, `Equipment` (camera, lens, film as a union), with readonly fields. Roll IDs parsed as `YYYY-NNN` (D7). `VersionId` branded like the other IDs; `Version` is a discriminated union by `kind` with only `lab-scan` in Phase 1, and every version has `width` and `height` (D13, D14). A helper for the version a frame shows (`defaultVersion`, else newest).
- [ ] **1.1.2 Edge numbers.** `EdgeNumber` type with parse and format for `"00"`, `"0"`, integers, `"12A"` and `"14-15"`; arithmetic only for numeric values (`"00"` = −1). Table-driven tests, plus a property test that format(parse(x)) = x for valid input.
- [ ] **1.1.3 Mapping engine.** Pure function from sorted scans and a `Mapping` (direction, anchors, overrides, skips) to a frame number per scan, following the rules in the plan. Rejects non-numeric anchors with `MappingInvalid`. Table-driven tests for up, down, `00`, several anchors, overrides and skips, plus property tests (for example, with one anchor and no overrides, consecutive scans differ by exactly one).
- [ ] **1.1.4 Mapping warnings.** Duplicate numbers and below `00` (D3), as warnings alongside the result.
- [ ] **1.1.5 Remap.** Applying a new mapping to a roll updates frame numbers only; IDs, metadata and versions stay with their scans. Tests.
- [ ] **1.1.6 Meta resolver.** `archive.meta` → `roll.meta` → `frame.meta`, with scalars replacing, maps merging, arrays replacing, `{ add, remove }` modifying and `null` clearing. Every value records its source layer and ID. Equipment slugs resolve to records, and dangling slugs are reported, not thrown. Table-driven tests for every rule, plus property tests.
- [ ] **1.1.7 Invariants.** Rating 0–5, frame and version IDs unique within a roll, no two versions in a roll with the same SHA-256, `defaultVersion` (if set) references a version of that frame, as validation functions that return `ValidationFailed`. (Unique roll IDs are enforced by the repository's `create`.)

### 1.2 Remaining ports and adapters

Each port gets: an interface with TSDoc, an in-memory adapter, the real adapter, and one contract suite run against both.

- [ ] **1.2.1 `BlobStore`.** Write-once streaming `put` returning SHA-256 and byte count, with a size limit enforced during the stream (D4); `get` and `stat`. No delete. The filesystem adapter writes into the roll's kind folder (`rolls/YYYY/YYYY-NNN/lab/`, D7) and refuses to overwrite. A failed or oversized `put` leaves no partial file.
- [ ] **1.2.2 File signature check.** A small domain function recognising allowed image types (JPEG to start with, plus the sleeve photo types) from their first bytes. Table-driven tests including a renamed non-image.
- [ ] **1.2.3 `HoldingArea`.** Replaces `ImportStaging` (removed by D11). `holdVersion` and `holdFrame` move the files and write the JSON (with the roll and frame they came from) into `deleted/<timestamp>-version-<versionId>/` or `deleted/<timestamp>-frame-<frameId>/`; `holdRoll` moves a roll's folder into `deleted/<timestamp>-roll-<rollId>/`. Timestamps from the `Clock`. Never deletes or overwrites. All paths through the safe path helper. Contract suite against in-memory and filesystem adapters.
- [ ] **1.2.4 `CatalogueIndex`.** `better-sqlite3` in the cache directory, with tables for rolls, frames, frame tags and equipment. Upsert a resolved roll, query with the `ListRolls` filters and sort orders (D9), and rebuild. Schema created from scratch; the index is disposable, so no migrations.
- [ ] **1.2.5 `PreviewProvider`.** sharp adapter producing a 400 px and a 2048 px WebP, keyed by SHA-256, cached in the cache directory, generated lazily, with sharp's input pixel limit set. Trivial in-memory adapter.
- [ ] **1.2.6 `Notifier`.** SSE adapter and a recording adapter for tests. Event types defined as a union in the contracts package.
- [ ] **1.2.7 `ImageInspector`.** Reads width and height from an image's header without decoding the whole image, with sharp's input pixel limit; a too-large or unreadable image is an error (D14). sharp adapter and a fake for tests, with a contract suite using the fixture scans.
- [ ] **1.2.8 Wire everything into both compositions.**

### 1.3 Use cases

Every use case has one `execute(ctx, input)`, returns `Result`, and is tested through `composeInMemory` with a fixed clock and sequential IDs, covering success and every error path. Writing use cases also update the index and notify, and their tests assert on both.

- [ ] **1.3.1 Archive.** `InitialiseArchive`, `GetArchive`, `UpdateArchive` (meta and labs, validating lab patterns compile and have `batch` and `scan` groups).
- [ ] **1.3.2 Equipment.** `ListEquipment`, `CreateEquipment` (slug from make and model, `AlreadyExists` on a clash).
- [ ] **1.3.3 Rolls.** `CreateRoll` (roll ID required, D8), `UpdateRoll`, `GetResolvedRoll`.
- [ ] **1.3.4 `ListRolls`.** Index query with year, camera, film and tag filters, sorted by roll ID or shot date (D9).
- [ ] **1.3.5 Frames.** `UpdateFrame` and bulk `UpdateFrames`, with bulk as a single roll save.
- [ ] **1.3.6 `CreateFrame` and `AddVersion`.** `CreateFrame` appends a frame (JSON, edge number optional) to an existing roll (404 otherwise). `AddVersion` takes a frame, `kind=lab-scan`, the lab, the file name and the file stream (D13); rejects a name not matching the lab pattern, an oversized file (D4), a wrong file signature, or another kind. It reads the pixel dimensions through `ImageInspector` (D14), stores the file through the blob store, then appends the version (batch and scan index from the file name) under the roll's lock. Neither needs a version token. A file whose hash is already in the roll returns `AlreadyExists` with the existing frame and version. Tests: parallel appends on one roll all land; a failed save leaves no orphaned file; adding to a roll that already has frames; a frame with no versions is valid.
- [ ] ~~**1.3.7, 1.3.8 Import use cases.**~~ Removed by D11.
- [ ] **1.3.9 Numbering.** Setting edge numbers in bulk goes through `UpdateFrames`; confirming numbering through `UpdateRoll`. Any mapping use cases *(blocked: mapping location)*.
- [ ] **1.3.10 `AttachSleevePhoto`.** Through the blob store, with the signature check.
- [ ] **1.3.11 `GetPreview` and `GetOriginal`.** Stream previews by hash, and originals by roll, frame and version ID; no path ever comes from the request (D13).
- [ ] **1.3.12 `CheckIntegrity`.** Validate files, check every version's file exists with the right size, optional full re-hash, and report dangling equipment references, unreferenced files and duplicate numbers. `deleted/` is skipped. Tests against the filesystem composition with deliberately broken fixtures.
- [ ] **1.3.13 `RebuildIndex`.**
- [ ] **1.3.14 `ReconcileExternalChange`.** Re-read the roll, validate, re-index and notify; invalid files are reported, not loaded.
- [ ] **1.3.15 `RenameRoll`.** Checks the new ID is free, renames through the repository, re-indexes and notifies (D10).
- [ ] **1.3.16 `DeleteVersion`, `DeleteFrame` and `DeleteRoll`.** Each saves the roll first, then hands the JSON and files to the holding area; a crash in between leaves only an unreferenced file, which the integrity check reports. Deleting the default version unsets `defaultVersion`. `DeleteRoll` works only when the roll has no frames (`ValidationFailed` otherwise). All require the roll's version (D12, D13).

### 1.4 HTTP API

Each route parses with the contracts schemas, calls one use case and maps errors (404, 422, 409). API tests cover status codes, validation errors and, where relevant, ETag and `If-Match`. The OpenAPI snapshot is updated in the same commit.

- [ ] **1.4.1 Error mapping and ETags.** A single function mapping domain errors to responses, and helpers for ETag (from the version token) and required `If-Match` (428 when missing, 409 when stale).
- [ ] **1.4.2 Archive and equipment routes.**
- [ ] **1.4.3 Roll and frame routes**, including `POST /api/rolls/{rollId}/frames` (JSON), bulk frame edits, the `sort` query parameter, `POST /api/rolls/{rollId}/rename`, and `DELETE` for frames and rolls (`If-Match` required).
- [ ] **1.4.4 Version routes.** `POST /api/rolls/{rollId}/frames/{frameId}/versions?kind=lab-scan&lab=&file=` with the image as the raw request body (`Content-Type: image/jpeg`), returning 201 with the version, or 409 with the existing frame and version IDs for a duplicate; query parameters validated as a union by `kind`. `DELETE …/versions/{versionId}` with `If-Match`. A raw image body can't be sent by a cross-site form, unlike multipart. Tests for oversized (413) and disguised (415) uploads, a bad file name or unsupported kind (422), and an unknown roll or frame (404).
- [ ] **1.4.5 Mapping routes** *(blocked: mapping location)*.
- [ ] **1.4.6 Sleeve, preview and original file routes.** Originals at `…/versions/{versionId}/file`; tests that malformed IDs are rejected and no route accepts a path.
- [ ] **1.4.7 SSE route** (`/api/events`).
- [ ] **1.4.8 Maintenance routes.**

### 1.5 File watcher

- [ ] **1.5.1 Watcher adapter.** chokidar on the archive folder, ignoring `deleted/`, calling `ReconcileExternalChange` for changed `roll.json` files and ignoring changes whose version token matches the service's own last write, and the folder move from its own renames. Integration test against a temp archive.

### 1a checkpoint

- [ ] **1a.1 Manual run.** Initialise an archive, create a roll and upload a few real scans as frames through the docs page, renumber them, and run the integrity check.

**Done when:** use-case and HTTP tests pass, and the manual run in 1a.1 succeeds.

---

## Phase 1, milestone 1b: Web UI, import and browse

UI tests use the generated client against a stubbed fetch, or the in-memory composition where practical; Playwright covers the full journey in 1c.

- [ ] **1b.1 App foundations.** Routing, TanStack Query provider, the generated client, and an SSE hook that invalidates affected queries. The service serves the built UI (D1).
- [ ] **1b.2 First-run setup.** Shown when the archive isn't initialised: name, author, copyright, first lab and its scan direction.
- [ ] **1b.3 Import step 1: roll.** Choose an existing roll, or create one first (D11), with camera, lens and film pickers that can create new equipment. The roll ID field starts empty, with a one-click suggestion of the next free number for the year being typed (current year until one is typed), from the roll list (D8). Shows a clash before submitting.
- [ ] **1b.4 Import step 2: upload.** Drag a folder or files; files not matching the lab pattern are listed and skipped. For each scan, create a frame and upload the scan as its version, a few in parallel, with progress and retries; a failed upload retries into the same frame. A 409 for a duplicate counts as done, so re-dropping the folder after an interruption simply completes the import. Leftover frames with no versions are shown and can be deleted.
- [ ] **1b.5 Import step 3: numbering.** Thumbnails in scan order; set anchor and direction, mark skips and overrides, see proposed numbers and warnings; save with one bulk frame update. Build this as a reusable numbering component, because 1c.4 uses it again. *(Blocked: mapping location, for where the proposed numbers are computed.)*
- [ ] **1b.6 Rolls grid.** Sleeve photo or first frame, filters, sort by roll ID or shot date (D9), "numbering not confirmed" badge (D6).
- [ ] **1b.7 Roll view.** Contact sheet in edge-number order, with roll details and the sleeve photo; frames with no versions show a placeholder.
- [ ] **1b.8 Frame view.** Large preview of the shown version, previous/next, resolved metadata with each value's source; the frame's versions listed, with "Set as default" and delete (D13); arrow keys and Esc.
- [ ] **1b.9 Checkpoint.** Import at least five real rolls, including one scanned in reverse, and browse them.

---

## Phase 1, milestone 1c: Editing and maintenance in the UI

- [ ] **1c.1 Frame editing.** Title, rating (keys 0–5), tags, notes, location, lens override. Inherited values greyed with their source; editing creates an override; "set on roll instead" and "clear override".
- [ ] **1c.2 Roll editing.** All roll fields and roll `meta`, equipment pickers, sleeve photo upload, rename as a separate, confirmed action (D10), and delete when the roll has no frames (D12).
- [ ] **1c.3 Bulk edit and delete.** Select frames on the contact sheet; set tags, location or lens in one save, or delete them after confirmation (D12).
- [ ] **1c.4 Fix numbering.** The numbering component from 1b.5 on an existing roll, then confirm.
- [ ] **1c.5 Conflict handling.** On a 409, reload the roll and re-apply the change if it doesn't clash; otherwise show what changed. Test with two simulated clients.
- [ ] **1c.6 Maintenance page.** Run the integrity check (quick or full) and rebuild the index.
- [ ] **1c.7 End-to-end test.** Playwright against `composeLocal` with a temp archive and fixture scans: first-run setup → import → fix numbering → edit a frame → reload and see it saved. Runs in CI.
- [ ] **1c.8 Checkpoint.** Catalogue a newly arrived roll end to end in the browser without opening a JSON file.

**Done when:** 1c.7 is green in CI and 1c.8 succeeds. That completes Phase 1.
