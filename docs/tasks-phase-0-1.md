# FilmFile tasks: Phase 0 and Phase 1

*Created 2 November 2026 from `docs/plan-phase-0-1.md`; restructured the same day to deliver a working slice first. The plan says what and why; this file is the ordered list of work. Tick tasks off here as they're done.*

Each task is about one commit: small enough to review in one sitting, with its tests in the same commit. `pnpm verify` passes at the end of every task. Persistence formats, field rules and the route list are in the plan and not repeated here.

## How we're delivering

1. **S1, API slice:** rolls and scans working through the API, end to end to files on disk.
2. **S2, contracts and a basic UI:** the same slice in the browser.
3. **H, hardening:** bring the slice up to the standards in `CLAUDE.md`: security, the hexagonal layers, error handling, atomic writes, contract suites.
4. **P, the rest of Phase 1:** numbering, metadata, equipment, the index, and so on, built to the full standard from the start.

For each endpoint in S1 and S2: **write the API test first**, then the simplest code that passes it, then improve. API tests use Hono's `app.request` against a temp archive on the real filesystem. In S1 and S2, routes may read and write files directly; milestone H moves that logic into use cases and ports.

**Until H.1–H.3 are done, the service has no Host or Origin checks**, so any web page could call it while it runs. Only run it while you're using it.

---

## Decisions

Settled on 2 November 2026 and recorded in `docs/design.md`. Tasks refer to them by number. The "Affects" column uses the original task IDs; tasks that moved into the slice or hardening say where they went.

| # | Decision | Affects |
| --- | --- | --- |
| D1 | The service serves the built UI at `/`, so UI and API share one origin. In development, Vite proxies `/api` to the service, and the allowed UI origin is set to the Vite dev server's through configuration. | 0.6.2, 1b.1 |
| D2 | The API docs page's assets are served by the service itself, not a CDN, so the CSP needs no exceptions. | 0.2.6 |
| D3 | No per-format "above the last frame" warning. Mapping warnings are duplicate numbers and below `00` only. | 1.1.4 |
| D4 | Lab scan uploads are limited to 200 MB per file, checked while streaming. | 1.3.6, 1.4.4 |
| D5 | *Superseded by D11:* there are no import sessions or staging. | |
| D6 | Unconfirmed numbering is shown with a badge on the roll only; frame numbers look normal. | 1b.6 |
| D7 | Roll numbers are `YYYY-NNN` (e.g. `2026-014`), stored under `rolls/YYYY/YYYY-NNN/`. `YYYY` is the year shot; `NNN` is the next free number in that year when catalogued. No other formats. | 1.1.1, 1.2.1 |
| D8 | The API never invents a roll number; `CreateRoll` requires one. The UI suggests the next free number for a year, worked out from the roll list, but the field starts empty. | 1.3.3, 1b.3 |
| D9 | Roll lists sort by roll number by default, or by shot date when chosen. Roll shot dates are optional. | 1.2.4, 1.3.4, 1b.6 |
| D10 | A roll number can be changed only by an explicit rename, which moves the roll's folder. The ULID is unchanged. | 0.4.1, 1.3.15, 1c.2 |
| D11 | The API has no import workflow. A roll is created first, then each frame is created and its lab scan uploaded as a version (D13); the UI drives the import. Frame numbers are optional on creation and can be set later. Creating a frame is an append that doesn't need `If-Match`; a scan whose hash is already in the roll returns 409, so retries are safe. Frames can be added to a roll that already has frames. | 1.3.6, 1.4.4, 1b.3–1b.5 |
| D12 | Frames can be deleted, and rolls can be deleted when they have no frames, as explicit, confirmed actions. Nothing is permanently deleted: deleted items move into `deleted/` in the archive, one dated folder each with the files and their JSON, and only the user empties it. No restore in the UI in Phase 1. | 0.4.1, 1.2.3, 1.3.16, 1c.2, 1c.3 |
| D13 | Image data and metadata have separate endpoints. Frames are JSON; images are uploaded as versions of a frame (`POST …/frames/{frameId}/versions?file=…`, raw body). Versions have ULIDs and no `kind`; `defaultVersion` and `parents` refer to version IDs, never paths. Phase 1 uploads lab scans only. A frame with no versions is valid. `defaultVersion` is optional; when unset the newest version is shown. A single version can be deleted into the holding area. Originals are read by version ID. | 1.1.1, 1.1.7, 1.3.6, 1.3.11, 1.3.16, 1.4.3–1.4.6, 1b.4, 1b.7, 1b.8 |
| D14 | No "preview" versions: on-screen images are generated previews of the frame's shown version, cached outside the archive. Every version records `width` and `height`, read by the `ImageInspector` port at upload. | 1.1.1, 1.2.7, 1.3.6 |
| D15 | A frame's `defaultVersion` (optional version ID) is the version the UI shows; when unset, the newest version is shown. It lives on the frame rather than as a flag on versions, so there can only be one. Set from the frame view. | 1.1.1, 1.1.7, 1b.8 |
| D16 | Versions have no `kind`: a version is a version, and `defaultVersion` decides what's shown. How Phase 2 tells raws, masters and lab scans apart where behaviour differs is an open question; a `source` attribute recording where a file came from may be added then. | 1.1.1, S1.5 |
| D17 | Files are stored by version, not by kind: `frames/<frame>/<version>/<original name>`, each folder named by the last 8 characters of the ULID and unique within its parent. Same-named files never clash, sidecars sit beside their file, and deletes move one folder. NegPy can build a virtual roll from frames anywhere, so it doesn't need a `raw/` folder. | S1.5, 1.2 |

**Still open** (in `docs/design.md`, section 15): where the mapping engine lives (service endpoint, shared package or UI), whether `roll.json` keeps the mapping used, and how Phase 2 tells versions apart without a `kind` (D16). Tasks that depend on it are marked *(blocked: mapping location)*.

---

## Done

- [x] **0.1.1–0.1.6 Repository and tooling.** Git, editor and Node config; pnpm workspace with supply-chain settings; strict TypeScript; Prettier, ESLint and Vitest with `pnpm verify`; layer boundaries enforced by lint and tested; CI running `pnpm verify`.
- [x] **0.2.1 `Result`.** `Result<T, E>`, `ok`, `err` and `assertNever` in `domain/shared/`.
- [x] **0.2.2 Domain errors.** `DomainError`: `NotFound`, `AlreadyExists`, `ConcurrencyConflict`, `ValidationFailed`, `MappingInvalid`. Used from H.6.

---

## S1: API slice — rolls and scans

Every task starts with API tests in `apps/backend/test/api/`, run against a temp archive.

- [x] **S1.1 Server runs.** A Hono app with `GET /api/health`. `composeLocal(config)` builds the app; `main.ts` reads the archive and cache directories and port from environment variables and serves on `127.0.0.1` with `@hono/node-server`, running the `.ts` source directly with Node. A temp archive helper for tests. API test: health returns 200.
- [x] **S1.2 Create a roll.** `POST /api/rolls` with `{ roll: "2026-014" }` creates `rolls/2026/2026-014/roll.json` with a ULID and an empty `frames` list, and returns 201 with the roll. API tests: the response, the file on disk, a second create with the same roll number returns 409.
- [x] **S1.3 List and get rolls.** `GET /api/rolls` reads every `roll.json` under `rolls/`; `GET /api/rolls/{rollId}` returns one by its ULID, or 404.
- [x] **S1.3a Basic Zod parsing.** Request bodies and `roll.json` are parsed with Zod schemas in the route file; invalid requests, including malformed JSON, return 422 with each issue's path and message. *(Brought forward from S2.1 and H.8, which move the schemas to the contracts package and the filesystem adapter.)*
- [x] **S1.4 Create a frame.** `POST /api/rolls/{rollId}/frames` with an optional frame number appends a frame with a ULID and no versions to `roll.json`, and returns 201.
- [x] **S1.5 Upload a lab scan.** `POST /api/rolls/{rollId}/frames/{frameId}/versions?file=12340014.jpg` with the image as the raw body writes it unchanged to the version's own folder, `frames/<frame>/<version>/` (D17), and appends a version with its ULID, SHA-256, size, width and height (read with sharp). A second upload of the same bytes returns 409. Tests generate a small JPEG with sharp.
- [x] **S1.6 Thumbnails and originals.** `GET /api/rolls/{rollId}/frames/{frameId}/versions/{versionId}/thumbnail?size=small|large` returns a 400 px or 2048 px WebP made with sharp and cached in the cache directory by content hash; `GET …/versions/{versionId}/file` returns the original.
- [x] **S1.7 Checkpoint.** Create a roll and upload a real roll's scans with `curl`, then open thumbnails in the browser.

**Done when:** API tests pass for every endpoint, and S1.7 works with real scans.

## S2: Contracts and a basic UI

- [x] **S2.1 Contracts and OpenAPI.** Define the S1 routes with `@hono/zod-openapi`, with request and response schemas in `@filmfile/contracts`. Serve `/api/openapi.json` and the docs page at `/api/docs` (assets served locally, D2). Snapshot test of the spec. Path parameters are validated as ULIDs (422). Malformed JSON is a 400 with the usual `{ error }` body, since 422 is for valid JSON that breaks the rules. The docs page is Swagger UI from `swagger-ui-dist`, with its telemetry dependency's install script blocked. *(Was 0.2.6, 0.3.1, 0.3.3.)*
- [x] **S2.2 Typed client.** Generate types from the spec with `openapi-typescript` and export an `openapi-fetch` client from the contracts package. A check in `pnpm verify` fails if the generated files are out of date. The spec is committed as `packages/contracts/openapi.json` and the types as `src/api-types.ts`, each checked by a file snapshot test; `pnpm generate` updates both. *(Was 0.3.2.)*
- [x] **S2.3 Web app shell.** Vite, React and TanStack Query in `apps/web`, calling the health endpoint through the typed client. The service serves the built UI; in development Vite proxies `/api` (D1). `pnpm dev` runs both against `.dev-archive/`; `pnpm build` builds the UI into `apps/web/dist`, which the backend serves, with `index.html` for any non-API path. UI tests use Testing Library with happy-dom. *(Was 0.3.4 and part of 1b.1.)*
- [x] **S2.4 Rolls page.** List rolls and create one with a roll number field (no suggestion yet).
- [x] **S2.5 Roll page.** Drop lab scans onto a roll: for each file, create a frame and upload the scan as its version, with progress. Upload one file at a time: until H.9 adds locking, two requests changing the same roll at once can lose one of the changes. Show a contact sheet of thumbnails. Scans already in the roll (by SHA-256, hashed in the browser) and file names the service would refuse are skipped before a frame is created, so they don't leave empty frames. New frames are numbered in upload order, on from the roll's highest plain number (1 for an empty roll): a first guess until 1.3.9 sets numbering from anchors. A dropped folder contributes the JPEGs directly inside it. Pages are routed by a few lines of our own (`routing.tsx`) until there are enough to justify a router.
- [x] **S2.6 Checkpoint.** Create a real roll in the browser, drop its scans, reload, and see everything still there.

**Done when:** S2.6 works with a real roll.

## H: Hardening the slice

Brings S1 and S2 up to the standards in `CLAUDE.md`. Security comes first.

- [x] **H.1 Host and Origin checks.** Middleware rejecting (403) a `Host` that isn't `localhost`, `127.0.0.1` or `[::1]` on the configured port, and any `Origin` other than the configured UI origin (D1). State-changing methods require a matching `Origin`. API tests for each case. The backend's own address is always an accepted origin; `FILMFILE_UI_ORIGIN` adds one for a separately served UI, which `pnpm dev` sets to Vite's `http://localhost:5173` (Vite's proxy sets the backend's Host; its port is fixed). Tools such as `scripts/upload-roll.sh` send the backend's own address as `Origin`. *(Was 0.6.2.)*
- [x] **H.2 Content type and security headers.** JSON bodies require `Content-Type: application/json` (415 otherwise). Every response gets the CSP, `X-Content-Type-Options`, `frame-ancestors 'none'` and `Referrer-Policy` headers. The scan upload likewise requires `image/jpeg` (the signature check comes in H.4). The docs page's CSP also allows inline styles and `data:` images, which Swagger UI uses; no script exceptions. *(Was 0.6.3.)*
- [x] **H.3 Error handler.** Unexpected errors return a generic 500 with a correlation ID, logged server-side; no stack trace or path in the response. *(Was 0.6.4.)*
- [x] **H.4 Safe paths and upload checks.** A safe path helper that every filesystem path goes through, rejecting absolute paths, `..`, separators in names, null bytes and anything resolving outside the root (table-driven traversal tests). Uploads: the 200 MB limit enforced while streaming (D4), a JPEG signature check, and sharp's input pixel limit; tests for oversized (413) and disguised (415) uploads. The pixel limit is 100 megapixels, checked from the header before anything is decoded (422), and passed to sharp for thumbnails; a file that starts like a JPEG but can't be read is also a 422. Paths stored in `roll.json` go through the helper too, so an edited `roll.json` can't serve files from elsewhere. *(Was 0.6.1, 1.2.2 and part of 1.4.4.)*
- [x] **H.5 IDs, clock and ID generator.** Branded `RollId`, `FrameId`, `VersionId` and `ArchiveId` with parse functions, and `ArchiveContext`. `Clock` and `IdGenerator` ports with node adapters, a fixed clock and a sequential generator for tests. IDs are branded through type guards, so no type assertions are needed. The routes already take the clock and generator (from `composeLocal`, which tests can override), so versions' `added` times and new IDs are predictable in tests. *(Was 0.2.3, 0.2.4.)*
- [ ] **H.6 Roll use cases and repository.** Move roll logic out of the routes into `CreateRoll`, `ListRolls` and `GetRoll` use cases (`execute(ctx, input)` returning `Result`) behind a `RollRepository` port with a filesystem adapter. Routes map `DomainError` to status codes in one place. *(Was part of 0.4.1, 1.3.3, 1.4.1.)*
- [ ] **H.7 Frame and version use cases.** `CreateFrame`, `AddVersion`, `GetThumbnail` and `GetOriginal` behind `BlobStore`, `ImageInspector` and `PreviewProvider` ports with their adapters. *(Was 1.2.1, 1.2.5, 1.2.7, 1.3.6, 1.3.11.)*
- [ ] **H.8 Persistence schemas and stable serialisation.** Zod schemas for `roll.json` (and `archive.json` and equipment files when they arrive), `schema: 1`, an empty migration registry, explicit mapping to domain types; fixed key order, 2-space indent and trailing newline, with a property test that a round trip is byte-identical. *(Was 0.4.4, 0.4.5.)*
- [ ] **H.9 Atomic writes and version tokens.** Per-file locks in the cache directory, version = SHA-256 of the file bytes, temp file + fsync + rename. Reads return `{ value, version }`; saves take the expected version. `ETag` on reads and `If-Match` on writes (428 when missing, 409 when stale); appends lock without needing a token (D11). Tests: concurrent saves serialise, parallel appends all land, a crash between write and rename leaves the original intact. *(Was 0.4.6 and the ETag part of 1.4.1.)*
- [ ] **H.10 In-memory adapters and contract suites.** One shared contract suite per port, run against the in-memory and filesystem adapters; `composeInMemory` for fast use-case tests. *(Was 0.4.2, 0.4.3 and the in-memory halves of 1.2.)*
- [ ] **H.11 Test data and fixtures.** Builders (`aRoll()`, `aFrame()`), and the lab scan generator with the fixture sets (head to tail, tail to head, a skipped frame, starting at `00`, a `12A`). *(Was 0.5.)*
- [ ] **H.12 Full CI and dependency updates.** Build, Playwright smoke test, `pnpm audit --audit-level high`, gitleaks, CodeQL (the repository is public), a macOS job for sharp; Dependabot including Actions SHAs; a lint-staged pre-commit hook. *(Was 0.6.5–0.6.7.)*

**Done when:** the security API tests pass (wrong `Host`, foreign `Origin`, missing content type, traversal, oversized and disguised uploads), the slice runs through use cases and ports with contract suites for every port, and the full CI pipeline is green.

---

## P: The rest of Phase 1

Built to the full standard from the start. Task IDs are the original ones; tasks absorbed into S or H are listed as such.

### Domain

- [ ] **1.1.1 Domain types.** `Archive`, `Roll`, `Frame`, `Version`, `Meta`, `Equipment` (camera, lens, film as a union), with readonly fields. Roll numbers parsed as `YYYY-NNN` (D7). `Version` has no `kind` (D16), and every version has `width` and `height` (D13, D14). A helper for the version a frame shows (`defaultVersion`, else newest).
- [ ] **1.1.2 Frame numbers.** `FrameNumber` type with parse and format for `"00"`, `"0"`, integers, `"12A"` and `"14-15"`; arithmetic only for numeric values (`"00"` = −1). Table-driven tests, plus a property test that format(parse(x)) = x for valid input.
- [ ] **1.1.3 Mapping engine.** Pure function from sorted scans and a `Mapping` (direction, anchors, overrides, skips) to a frame number per scan, following the rules in the plan. Rejects non-numeric anchors with `MappingInvalid`. Table-driven and property tests. *(Blocked: mapping location, for where it runs.)*
- [ ] **1.1.4 Mapping warnings.** Duplicate numbers and below `00` (D3), as warnings alongside the result.
- [ ] **1.1.5 Remap.** Applying a new mapping to a roll updates frame numbers only; IDs, metadata and versions stay with their scans.
- [ ] **1.1.6 Meta resolver.** `archive.meta` → `roll.meta` → `frame.meta`, with scalars replacing, maps merging, arrays replacing, `{ add, remove }` modifying and `null` clearing. Every value records its source layer and ID. Equipment slugs resolve to records, and dangling slugs are reported, not thrown.
- [ ] **1.1.7 Invariants.** Rating 0–5, frame and version IDs unique within a roll, no two versions in a roll with the same SHA-256, `defaultVersion` (if set) references a version of that frame.

### Ports and adapters

- 1.2.1 `BlobStore`, 1.2.2 file signature check, 1.2.5 `PreviewProvider` and 1.2.7 `ImageInspector`: *in H.4 and H.7.*
- [ ] **1.2.3 `HoldingArea`.** `holdVersion`, `holdFrame` and `holdRoll` move files and write their JSON into dated folders under `deleted/` (D12). Never deletes or overwrites.
- [ ] **1.2.4 `CatalogueIndex`.** `better-sqlite3` in the cache directory: rolls, frames, frame tags and equipment; upsert a resolved roll, query with the `ListRolls` filters and sort orders (D9), rebuild. Replaces the S1 directory scan for listing.
- [ ] **1.2.6 `Notifier`.** SSE adapter and a recording adapter for tests. Event types as a union in the contracts package.
- [ ] **ArchiveRepository and EquipmentRepository.** Ports, filesystem and in-memory adapters, contract suites. *(The rest of 0.4.1.)*

### Use cases

- 1.3.3 `CreateRoll` and `GetRoll`, 1.3.6 `CreateFrame` and `AddVersion`, 1.3.11 `GetThumbnail` and `GetOriginal`: *in H.6 and H.7.*
- [ ] **1.3.1 Archive.** `InitialiseArchive`, `GetArchive`, `UpdateArchive` (meta and labs, validating lab patterns compile and have `batch` and `scan` groups). Then `AddVersion` checks file names against the lab's pattern and records batch and scan index.
- [ ] **1.3.2 Equipment.** `ListEquipment`, `CreateEquipment` (slug from make and model, `AlreadyExists` on a clash).
- [ ] **1.3.3 `UpdateRoll` and resolved rolls.** `UpdateRoll`; `GetRoll` returns resolved metadata with provenance.
- [ ] **1.3.4 `ListRolls` filters.** Year, camera, film and tag filters, sorted by roll number or shot date (D9), through the index.
- [ ] **1.3.5 Frames.** `UpdateFrame` and bulk `UpdateFrames`, with bulk as a single roll save.
- [ ] **1.3.9 Numbering.** Setting frame numbers in bulk through `UpdateFrames`; confirming numbering through `UpdateRoll`. Any mapping use cases *(blocked: mapping location)*.
- [ ] **1.3.10 `AttachSleevePhoto`.** Through the blob store, with the signature check.
- [ ] **1.3.12 `CheckIntegrity`.** Validate files, check every version's file exists with the right size, optional full re-hash; report dangling equipment references, unreferenced files and duplicate numbers. `deleted/` is skipped.
- [ ] **1.3.13 `RebuildIndex`.**
- [ ] **1.3.14 `ReconcileExternalChange`.** Re-read the roll, validate, re-index and notify; invalid files are reported, not loaded.
- [ ] **1.3.15 `RenameRoll`.** Checks the new ID is free, renames through the repository, re-indexes and notifies (D10).
- [ ] **1.3.16 `DeleteVersion`, `DeleteFrame` and `DeleteRoll`.** Each saves the roll first, then hands the JSON and files to the holding area. Deleting the default version unsets `defaultVersion`. `DeleteRoll` only when the roll has no frames. All require the roll's version (D12, D13).

### HTTP API

- [ ] **1.4.2 Archive and equipment routes.**
- [ ] **1.4.3 Remaining roll and frame routes.** Bulk frame edits, `sort` and filter query parameters, `POST /api/rolls/{rollId}/rename`, `DELETE` for frames, versions and rolls (`If-Match` required).
- [ ] **1.4.5 Mapping routes** *(blocked: mapping location)*.
- [ ] **1.4.6 Sleeve route.**
- [ ] **1.4.7 SSE route** (`/api/events`).
- [ ] **1.4.8 Maintenance routes.**

### File watcher

- [ ] **1.5.1 Watcher adapter.** chokidar on the archive folder, ignoring `deleted/` and the service's own writes and renames, calling `ReconcileExternalChange` for changed `roll.json` files. Integration test against a temp archive.

### Web UI

- [ ] **1b.1 Live updates.** An SSE hook that invalidates affected queries.
- [ ] **1b.2 First-run setup.** Shown when the archive isn't initialised: name, author, copyright, first lab and its scan direction.
- [ ] **1b.3 Roll creation in full.** Camera, lens and film pickers that can create equipment; roll number suggestion (D8); clash shown before submitting.
- [ ] **1b.4 Robust upload.** Files not matching the lab pattern are listed and skipped; parallel uploads with retries; a 409 for a duplicate counts as done, so re-dropping a folder completes an interrupted import; leftover frames with no versions can be deleted.
- [ ] **1b.5 Numbering.** Thumbnails in scan order; anchor and direction, skips and overrides, proposed numbers and warnings; save with one bulk update. A reusable component for 1c.4. *(Blocked: mapping location.)*
- [ ] **1b.6 Rolls grid.** Sleeve photo or first frame, filters, sort (D9), "numbering not confirmed" badge (D6).
- [ ] **1b.7 Roll view.** Contact sheet in frame-number order, roll details and sleeve photo; frames with no versions show a placeholder.
- [ ] **1b.8 Frame view.** Large preview, previous/next, resolved metadata with sources, the frame's versions with "Set as default" and delete; arrow keys and Esc.
- [ ] **1b.9 Checkpoint.** Import at least five real rolls, including one scanned in reverse, and browse them.
- [ ] **1c.1 Frame editing.** Title, rating (keys 0–5), tags, notes, location, lens override; inherited values greyed with their source; "set on roll instead" and "clear override".
- [ ] **1c.2 Roll editing.** All roll fields and `meta`, equipment pickers, sleeve photo upload, rename (D10), delete when empty (D12).
- [ ] **1c.3 Bulk edit and delete.** Select frames; set tags, location or lens in one save, or delete after confirmation.
- [ ] **1c.4 Fix numbering.** The numbering component on an existing roll, then confirm.
- [ ] **1c.5 Conflict handling.** On a 409, reload and re-apply if it doesn't clash; otherwise show what changed.
- [ ] **1c.6 Maintenance page.** Integrity check (quick or full) and index rebuild.
- [ ] **1c.7 End-to-end test.** Playwright against `composeLocal` with a temp archive and fixture scans: first-run setup → import → fix numbering → edit a frame → reload and see it saved. Runs in CI.
- [ ] **1c.8 Checkpoint.** Catalogue a newly arrived roll end to end in the browser without opening a JSON file.

**Done when:** 1c.7 is green in CI and 1c.8 succeeds. That completes Phase 1.
