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
| D3 | ~~Mapping warnings~~: superseded by D19, which has no numbering warnings. | — |
| D4 | Lab scan uploads are limited to 200 MB per file, checked while streaming. | 1.3.6, 1.4.4 |
| D5 | *Superseded by D11:* there are no import sessions or staging. | |
| D6 | ~~Unconfirmed numbering badge~~: dropped. Rolls have no "numbering confirmed" state (D20). | — |
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
| D18 | A `roll.json` that can't be read (invalid JSON, not matching the schema, or from a newer FilmFile) doesn't fail the roll list: it's listed under `unreadable` with the problem, and shown in the UI. It's never changed or deleted, and a new roll can't be created over it. | H.8 |
| D19 | Frame numbering is driven from the UI. A frame number is free text of up to 9 characters, sorted naturally (leading number, negatives first, then text). Upload keeps numbering new frames in file-name order. Renumbering is a first number and a direction (plain integers, below zero if need be), worked out in the UI with a preview; the API stores only the numbers, in one save guarded by the roll's version. No anchors, overrides, skips or warnings; `00` is typed by hand. | N1–N8 |
| D20 | No "numbering confirmed" state, badge or button: a roll's numbers are simply what they are, corrected by editing or renumbering. | N7, N8 (dropped) |
| D21 | The interface follows design A ("light table") from the options canvas. Its fonts (Inter, IBM Plex Mono) are served by the backend from installed packages, not Google Fonts, so the CSP stays `default-src 'self'`. | U2 |
| D22 | Browser tests cover key journeys only, written against what a person sees and does (roles, labels, text), never CSS classes, test IDs, URLs or API calls, so refactoring the internals doesn't change them. Shared steps live in journey helpers. | U1 onwards |
| D23 | The rolls page's view (grid or list), grouping and filter are kept in the page's address, the view in every history entry so back and forward restore it. The grid or list choice, and whether the browse panel is open, are also remembered in the browser for fresh visits. | U4, U6 |
| D24 | A roll belongs to at most one event, which may be nested in another. Frames can be in events too (D25). Events come in stages: flat events (U12a), the Events page to create and edit them with dates (U12b), then sub-events (U12c). | U12a–U12c |
| D25 | Frames inherit their roll's camera, film stock, lens and events and can have their own, set in bulk on selected frames. A roll has at most one event; a frame can be in several. Grouping and filtering rolls use the roll's own values; an event's page shows frames from every roll. | U14–U17 |
| D26 | Locations are a place name with optional latitude and longitude, settable on events, rolls and frames, and inherited like the other details (design section 6). Coordinates are entered as text for now: a map picker would need map tiles from outside, which the CSP blocks (D21). | U18 |
| D27 | A roll has an optional name and description, and an optional date shot of varying precision: a year at least, then month, day and time (`2026`, `2026-09`, `2026-09-14`, `2026-09-14T15:30`, local time). The new roll page requires at least the year, starting it from the roll number, and marks required fields with an orange *. Rolls are created on their own page with their details and scans, not from a field on the rolls page. | U7 |
| D28 | A camera has a make and model (e.g. Nikon, FE), shown together ("Nikon FE"), its slug made from them (`nikon-fe`); format and notes wait until the UI uses them. Cameras, film stocks and lenses are each chosen from a dropdown whose last option, Add new…, asks for the new one's details. A camera file from before makes and models were kept apart (schema 1, one name) is read with its first word as the make. | U9a, U11a |
| D29 | A film stock has a make and name (e.g. Kodak, Portra) and optionally an ISO, a type (black and white, colour negative or colour slide) and a format (35mm, 120, 220, 127, 110, 4×5, 8×10). It's shown as make, name and ISO, e.g. "Kodak Portra 400", and its slug is made from that (`kodak-portra-400`), so stocks differing only in speed are told apart. No development process. It's chosen from a dropdown, not typed: its last option, Add new…, asks for a new film stock's make and name (required), ISO, type and format. | U10a |
| D30 | A lens has a make and name (e.g. Nikon, Nikkor AI-S) and optionally a focal length in millimetres and a widest aperture as an f-number. It's shown as "Nikon Nikkor AI-S 50mm f/1.8", and its slug is made from that (`nikon-nikkor-ai-s-50mm-f-1-8`). Mount, zooms and notes wait until the UI uses them. | U11b |
| D31 | An event is a name and the slug made from it (`events/iceland-2026.json`), and a roll names its event in a top-level `event` field of roll.json; dates arrive with U12b, the parent with U12c, and notes and location when the UI uses them. The API's events are at `/api/events`, so live updates move to `/api/changes`. | U12a |
| D32 | Events are created and edited on the Events page (New event, and editing each event's name, dates and, later, parent). The roll forms' Add new… stays as a shortcut that creates an event from its name alone; its dates are added on the Events page. An event's dates are an optional start and end, each a year with optional month and day; events are listed newest first by start date. Renaming an event keeps its slug. | U12b |

**Still open** (in `docs/design.md`, section 15): how Phase 2 tells versions apart without a `kind` (D16).

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
- [x] **H.6 Roll use cases and repository.** Move roll logic out of the routes into `CreateRoll`, `ListRolls` and `GetRoll` use cases (`execute(ctx, input)` returning `Result`) behind a `RollRepository` port with a filesystem adapter. Routes map `DomainError` to status codes in one place. *(Was part of 0.4.1, 1.3.3, 1.4.1.)* Done with domain `Roll`, `Frame`, `Version` and `RollNumber` types, `roll.json` parsed and mapped explicitly in the filesystem adapter, and an in-memory repository (brought forward from H.10) for the use-case tests. `ListRolls` returns the rolls rather than a `Result`, since it can't fail in an expected way. Frame and version routes use the repository directly until H.7. Every request uses a placeholder `ArchiveContext` until 1.3.1 gives the archive an ID.
- [x] **H.7 Frame and version use cases.** `CreateFrame`, `AddVersion`, `GetThumbnail` and `GetOriginal` behind `BlobStore`, `ImageInspector` and `PreviewProvider` ports with their adapters. *(Was 1.2.1, 1.2.5, 1.2.7, 1.3.6, 1.3.11.)* `ImageInspector` also hashes the file and does the JPEG signature and pixel checks, so duplicates are caught before anything is stored. `BlobStore` decides the file's path and returns it; `put` takes the bytes rather than a stream for now (uploads are capped at 200 MB). New domain errors `ImageRejected` and `ScanAlreadyInRoll` keep 409/415/422 in the one error mapper. Folder naming moved to the domain, since the layout is an archive rule. In-memory blob store and preview provider serve the use-case tests.
- [x] **H.8 Persistence schemas and stable serialisation.** Zod schemas for `roll.json` (and `archive.json` and equipment files when they arrive), `schema: 1`, an empty migration registry, explicit mapping to domain types; fixed key order, 2-space indent and trailing newline, with a property test that a round trip is byte-identical. *(Was 0.4.4, 0.4.5.)* The schema and mapping arrived with H.6; this added the migration registry, `fast-check` property tests that a round trip gives back the same roll and byte-identical text, and reporting of unreadable files: `GET /api/rolls` returns `{ rolls, unreadable }`, and the rolls page names each unreadable roll and its problem (D18).
- [x] **H.9 Atomic writes and version tokens.** Per-file locks in the cache directory, version = SHA-256 of the file bytes, temp file + fsync + rename. Reads return `{ value, version }`; saves take the expected version. `ETag` on reads and `If-Match` on writes (428 when missing, 409 when stale); appends lock without needing a token (D11). Tests: concurrent saves serialise, parallel appends all land, a crash between write and rename leaves the original intact. *(Was 0.4.6 and the ETag part of 1.4.1.)* Done with two changes. Locks are per roll within the service (`KeyedLock`), not lock files: the service is the archive's only writer, and a startup check that no other service has the archive open would guard that more simply than per-file lock files. `If-Match` (428 when missing, 409 when stale) arrives with the first endpoint that edits a roll (1.4.1): today's writes are creates and appends, which need no token (D11). Appends use `RollRepository.change`, which reads, applies and writes under the roll's lock. Creating a roll writes a temp file and hard-links it into place, so it's atomic and can't replace an existing roll.json.
- [x] **H.10 In-memory adapters and contract suites.** One shared contract suite per port, run against the in-memory and filesystem adapters; `composeInMemory` for fast use-case tests. *(Was 0.4.2, 0.4.3 and the in-memory halves of 1.2.)* Contract suites in `apps/backend/test/contracts/` for `RollRepository`, `BlobStore` and `PreviewProvider`, each run against its in-memory and real adapter; adapter tests keep only what's specific to them. `ImageInspector` has one adapter (sharp, which needs no disk), so no suite yet. `composeLocal` and `composeInMemory` share `useCasesFor`, so only their adapters differ.
- [x] **H.11 Test data and fixtures.** Builders (`aRoll()`, `aFrame()`), and the lab scan generator with the fixture sets (head to tail, tail to head, a skipped frame, starting at `00`, a `12A`). *(Was 0.5.)* Builders take plain override objects (`aRoll({ roll: '2025-003' })`, `labScanFrames(36)`) in `apps/backend/test/support/builders.ts`. Lab scans are 240×160 JPEGs showing the frame number in seven-segment digits drawn with SVG shapes (no fonts needed); each fixture set has six scans and its own batch, in `test/support/lab-scans.ts`.
- [x] **H.12 Full CI and dependency updates.** Build, Playwright smoke test, `pnpm audit --audit-level high`, gitleaks, CodeQL (the repository is public), a macOS job for sharp; Dependabot including Actions SHAs; a lint-staged pre-commit hook. *(Was 0.6.5–0.6.7.)* CI jobs: verify and build on Ubuntu and macOS, the Playwright smoke test (`test/e2e/`, the S2.6 journey against the built UI), `pnpm audit`, and gitleaks over the whole history; CodeQL in its own workflow, weekly too. Dependabot has a 3-day cooldown to match `minimumReleaseAge`. The pre-commit hook is a few lines of shell in `.githooks/`, not lint-staged, and only checks.

**Done when:** the security API tests pass (wrong `Host`, foreign `Origin`, missing content type, traversal, oversized and disguised uploads), the slice runs through use cases and ports with contract suites for every port, and the full CI pipeline is green.

---

## N: Frame numbering

Driven from the UI (D19). Each task is a change you can see in the browser, with its tests at every level it touches.

- [x] **N1 Frame order.** The roll's contact sheet is sorted by frame number, with a toggle back to scan order (the order frames were added). Natural sort: leading number first, negatives before positives, then the rest as text; frames with no number last. UI only.
- [x] **N2 Number labels.** Each thumbnail is captioned with its frame number in large type; a frame with no number shows a muted dash. UI only.
- [x] **N3 Edit one number.** Click a frame's number to edit it in place; Enter saves, Esc cancels. Any text up to 9 characters; empty clears the number. API: `PATCH /api/rolls/{rollId}/frames/{frameId}` with the number, `If-Match` required (428 when missing, 409 when stale).
- [x] **N4 Changed elsewhere.** When a save is refused because the roll changed since the page loaded, the page says "This roll changed since you opened it" with a Reload button. Nothing is overwritten.
- [x] **N5 Renumber preview.** A Renumber panel on the roll page that reads as a sentence: "[First|Last] scan is frame [N], counting [up|down]", so a tail-to-head roll is "last scan is frame 1, counting down". The contact sheet shows the proposed numbers in scan order, changed ones highlighted. Plain integers, going below zero if need be. Nothing is saved. UI only.
- [x] **N6 Save a renumber.** Save writes every proposed number in one bulk update with `If-Match`; Cancel discards the draft. API: bulk update of frame numbers.
- [-] **N7 Confirm numbering** and **N8 Changing confirmed numbering.** *(Dropped, D20.)*

**Done when:** a real roll scanned tail to head can be renumbered and a frame's number corrected, all in the browser.

## U: The Option A interface

The "light table" design chosen from the options canvas (https://claude.ai/artifact/BfhJttJe5NC679GGg97Ay1, row A): dark and photo first, a rolls page with a Grid | List switch, Group by, and a browse panel that can be closed, and a roll page with its details above the contact sheet. Built in two stages: first the design with the data that exists today, then one layer of data at a time (shot date, camera, film stock, lens, events), each layer arriving through every level it needs and showing up wherever the design puts it.

### Browser tests for key journeys

The Playwright tests describe what a person does and sees, so they stay the same when the internals are refactored, and change only when the behaviour does (D22):

- They find things the way a person does: by role, label and visible text (`getByRole('button', { name: 'Renumber…' })`), never by CSS class, test ID, URL structure or API call.
- Steps shared by several journeys (create a roll, add scans, renumber) live in small helpers in `test/e2e/support/`, so a change to how the UI does a step is made in one place.
- Each journey uses its own roll numbers and data, so journeys can run in any order against one backend.
- Scans come from the lab scan fixtures, which show their frame numbers.
- A journey is added or extended in the same task as the feature it covers; detail stays in the unit and component tests underneath.

Key journeys, each named by the task that adds it:

| Journey | What it proves |
|---|---|
| Catalogue a roll (exists) | Create a roll, add its scans, correct a frame number, reload and find it all there |
| Renumber a roll (exists) | A tail-to-head roll renumbered as "last scan is frame 1, counting down", saved and reloaded |
| Find rolls (U6) | Switch grid and list, group by year, filter by year, close and reopen the browse panel |
| Describe a roll (U7 onwards) | Create a roll with its name, description, date, scans, camera, film stock and lens, then find it grouped and filtered by each |
| Organise by event (U12a–U12c) | Create an event, put rolls in it, and browse to them by event; give it dates on the Events page; then an event inside another, whose rolls show under its parent too |
| Bulk edit (U16) | Select some of a roll's frames, put them in an event and give them another camera, then find them under that event with the roll's other frames left as they were |

### The design, with today's data

- [x] **U1 Journeys first.** Move the shared steps of the two existing journeys into helpers in `test/e2e/support/`, and replace their CSS class selectors with roles, labels and text, adding accessible names where the UI lacks them (e.g. a frame's number as part of its list item's name). The journeys then pass unchanged through the restyling that follows.
- [x] **U2 Light table look.** The dark theme as tokens (colours, spacing, radii) in one stylesheet; Inter for text and IBM Plex Mono for roll and frame numbers, both served by the backend from installed packages (the CSP allows only the service's own origin, D21); the header with FilmFile and the Rolls link. Contrast checked to 4.5:1. Every existing screen restyled, with no change in behaviour: the journeys pass unchanged.
- [x] **U3 Rolls grid.** Roll cards: a three-frame peek of the first scans, the roll number in monospace, the frame count, and "No frames yet" for an empty roll. "New roll" opens the roll number field and Create in place.
- [x] **U4 Rolls list and the switch.** The compact table (roll, a four-frame strip, frames) and a Grid | List switch, remembered in the browser (D23). Columns for camera, film stock, event and shot arrive with their data.
- [x] **U5 Roll page layout.** The roll number heading with the frame count, Add scans in the toolbar opening the drop zone, the order choice and Renumber… beside the contact sheet, and the amber renumber bar. While renumbering, each changed frame shows its new number on an amber tag with the old number beside it, greyed out and struck through, and the bar says how many numbers will change.
- [x] **U6 Group by, browse panel and filters, with years.** Group by Nothing or Year (from the roll number), with a heading and count per group. The browse panel lists Years with counts; choosing one filters the rolls and the heading says so; All rolls clears it. The panel toggle in the header hides and shows it, and the grid spreads to fill the room. View, grouping and filter are kept in the page's address, so reload, back and forward, and bookmarks keep them (D23). Adds the "Find rolls" journey.

**Checkpoint:** the app looks like the chosen design and every existing journey passes unchanged.

### Layers of data

Each layer is one vertical slice: the field in the domain, `roll.json` (an optional field with a default, so older files still read), the API and contracts, the new roll page and "Edit details", and wherever the design shows it: the roll page's details row, cards, list columns, the browse panel, Group by and filters. Each extends the "Describe a roll" journey.

- [x] **U7 New roll page.** New roll opens its own page (`/rolls/new`) instead of a field on the rolls page. It asks for the roll's details: roll number, name, description, and the date it was shot, which needs a year and can add month, day and time (D27). The roll number and year are marked required with an orange *. Scans can be dropped or chosen on the same page, and are listed until the roll is created. Create roll saves the roll with its details, uploads the scans with progress, and opens the roll's page. The details show on cards (name, and the date as "Sep 2026"), in the list (Name and Shot columns) and on the roll page. Rolls can also be sorted by roll number or date shot (D9). Starts the "Describe a roll" journey. Later layers (camera, film stock, lens, event) add their fields to this page.
- [x] **U8 Edit details.** An "Edit details" panel on the roll page for the same fields, saved with `If-Match` like the frame numbers (a roll changed elsewhere is never overwritten). API: `PATCH /api/rolls/{rollId}`.
- [x] **U9a Record a roll's camera.** Cameras as equipment records (`equipment/cameras/<slug>.json`, the slug made from the name; D28), listed and added through `GET`/`POST /api/equipment/cameras`. The new roll page and Edit details have a Camera field that offers the archive's cameras and adds a new one when a new name is typed; a roll keeps its camera's slug in `meta.camera`. Shown in the roll page's details row, on cards ("Nikon FE · Sep 2026") and as a List column.
- [x] **U9b Find rolls by camera.** Group by Camera, with "No camera" last; a Cameras section in the browse panel with counts, filtering the rolls by camera (`?camera=<slug>`; a year or a camera, one at a time, from the panel).
- [x] **U10a Record a roll's film stock.** Film stocks as equipment records (`equipment/films/<slug>.json`: make, name, ISO, type and format; D29), listed and added through `GET`/`POST /api/equipment/films`. The new roll page and Edit details have a Film stock dropdown of the archive's film stocks, whose last option, Add new…, asks for the new film stock's details. A roll keeps its film stock's slug in `meta.film`. Shown in the details row, on cards ("Nikon FE · Kodak Portra 400 · Sep 2026") and as a List column.
- [x] **U10b Find rolls by film stock.** Group by Film stock, with "No film stock" last; a Film stocks section in the browse panel with counts, filtering the rolls by film stock (`?film=<slug>`; the heading names every filter, e.g. "Rolls of Kodak Portra 400 shot on Nikon FE in 2026").
- [x] **U11a Camera dropdown, make and model.** The Camera field becomes a dropdown like Film stock, with Add new… asking for the make and model (D28); camera files move to schema 2, older ones upgraded when read. The dropdown, its "—" and Add new…, and the none/existing/new choice are shared by every kind of equipment.
- [x] **U11b Lens.** A lens per roll, chosen from a dropdown or added with Add new… (`equipment/lenses/<slug>.json`: make and name, required, and focal length and maximum aperture; D30), kept in the roll's `meta.lens` and shown in the details row, e.g. "Nikon Nikkor AI-S 50mm f/1.8". Group by Lens, with "No lens" last, and a Lenses section in the browse panel filtering the rolls by lens (`?lens=<slug>`), as for cameras and film stocks; the roll's own lens, until frames have their own (U15).
- [x] **U12a Events.** Events with a name (`events/<slug>.json`), chosen for a roll on the new roll page and in Edit details from a dropdown whose Add new… asks for the new event's name, as for equipment; a roll belongs to at most one event (D24). Shown in the roll's details row, on cards and as a List column; Group by Event, with "No event" last; an Events section in the browse panel with counts, filtering the rolls by event (`?event=<slug>`). An Events page, from the header's Events link, lists the events with how many rolls each has, each linking to its rolls. Adds the "Organise by event" journey.
- [ ] **U12b Events page: create and edit.** The Events page gets a New event button and lets each event be edited: a name, and optional start and end dates of the same precision as a roll's date shot (a year, then month and day; no end for a single day or month; the end not before the start). Events are listed newest first, by start date, with their dates shown ("Iceland 2026 · 12–19 Sep 2026") and undated events last; the browse panel and the Event dropdown follow the same order. Renaming keeps the event's slug, so rolls stay in it. The roll forms keep Add new… as a shortcut that asks only for the name (D32).
- [ ] **U12c Sub-events.** An event can have a parent event, set on the Events page when it's added or edited, e.g. "Jökulsárlón day" inside "Iceland 2026". Cards, list and details row show "Parent › Event"; the Events page and browse panel show events nested under their parents, and choosing a parent includes its sub-events' rolls. Group by Event groups by the roll's own event. An event can't be its own ancestor. Extends the "Organise by event" journey with a sub-event.
- [ ] **U13 Equipment page.** The Equipment link: cameras, lenses and film stocks with how many rolls use each, each linking to the rolls filtered by it.

**Checkpoint:** a real roll can be catalogued in the browser with its name, description, date shot, camera, film stock, lens and event, found again by grouping and filtering on each.

### Bulk editing and locations

Selecting frames on a roll and giving them all an event, camera, film stock or lens at once. Frames inherit these from their roll and can have their own, as the design's metadata layering describes (section 6): a frame shot on a second camera, or the few frames of a roll that belong to a particular event (D25).

- [ ] **U14 Select frames.** A Select mode on the roll page: a checkbox on each frame, click to toggle and shift-click for a run, Select all and Clear, a count ("4 frames selected"), and Esc to leave. Works from the keyboard. Nothing is saved; the selection is the start of the bulk actions.
- [ ] **U15 Frames' own details.** Frames gain their own camera, film stock, lens and events, each empty unless set, in which case the roll's applies (resolved as in the design, recording where each value came from). The contact sheet marks frames whose details differ from the roll's. A frame may be in several events.
- [ ] **U16 Assign to selected frames.** With frames selected, a bar offers "Set event", "Set camera", "Set film stock" and "Set lens" for them, or "Use the roll's" to clear their own; the change is one save with `If-Match`, so a roll changed elsewhere isn't overwritten. Adds the "Bulk edit" journey.
- [ ] **U17 Events across rolls.** An event's page shows its frames from every roll, whether the frame is in the event itself or through its roll; browsing by event includes a roll when any of its frames is in that event.
- [ ] **U18 Locations.** A location (a place name, with latitude and longitude if known) can be set on an event, a roll or a frame, and is inherited down the design's layers: roll, then its events (parent before child), then the frame (D26). Set in Edit details for a roll, on an event's page, and with "Set location" for selected frames (U16's bar). Shown in the roll's details row and for each frame, with where it came from ("Jökulsárlón — event"). Coordinates are typed or pasted, e.g. from a maps app; picking on a map is an open question.

**Done when:** a real roll can be catalogued in the browser with its shot date, camera, film stock, lens, event and location, frames that differ can be selected and given their own, everything can be found again by grouping and filtering, and every key journey passes in CI.

## P: The rest of Phase 1

Built to the full standard from the start. Task IDs are the original ones; tasks absorbed into S or H are listed as such.

### Domain

- [ ] **1.1.1 Domain types.** `Archive`, `Roll`, `Frame`, `Version`, `Meta`, `Equipment` (camera, lens, film as a union), with readonly fields. Roll numbers parsed as `YYYY-NNN` (D7). `Version` has no `kind` (D16), and every version has `width` and `height` (D13, D14). A helper for the version a frame shows (`defaultVersion`, else newest).
- [-] **1.1.2 Frame numbers.** *(Replaced by free-text numbers sorted naturally, N1 and D19.)* `FrameNumber` type with parse and format for `"00"`, `"0"`, integers, `"12A"` and `"14-15"`; arithmetic only for numeric values (`"00"` = −1). Table-driven tests, plus a property test that format(parse(x)) = x for valid input.
- [-] **1.1.3 Mapping engine.** *(Replaced by the renumber in N5, D19.)* Pure function from sorted scans and a `Mapping` (direction, anchors, overrides, skips) to a frame number per scan, following the rules in the plan. Rejects non-numeric anchors with `MappingInvalid`. Table-driven and property tests. *(Blocked: mapping location, for where it runs.)*
- [-] **1.1.4 Mapping warnings.** *(Dropped, D19.)* Duplicate numbers and below `00` (D3), as warnings alongside the result.
- [-] **1.1.5 Remap.** *(Replaced by N5 and N6.)* Applying a new mapping to a roll updates frame numbers only; IDs, metadata and versions stay with their scans.
- [ ] **1.1.6 Meta resolver.** *(For camera, film stock, lens and events: U15.)* `archive.meta` → `roll.meta` → `frame.meta`, with scalars replacing, maps merging, arrays replacing, `{ add, remove }` modifying and `null` clearing. Every value records its source layer and ID. Equipment slugs resolve to records, and dangling slugs are reported, not thrown.
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
- [ ] **1.3.2 Equipment.** *(Cameras, film stocks and lenses: U9–U11.)* `ListEquipment`, `CreateEquipment` (slug from make and model, `AlreadyExists` on a clash).
- [ ] **1.3.3 `UpdateRoll` and resolved rolls.** *(`UpdateRoll`: U7.)* `UpdateRoll`; `GetRoll` returns resolved metadata with provenance.
- [ ] **1.3.4 `ListRolls` filters.** *(Year, camera, film and event filters and shot-date sorting: U6, U8–U12c, in the UI first; through the index when the folder scan is too slow.)* Year, camera, film and tag filters, sorted by roll number or shot date (D9), through the index.
- [ ] **1.3.5 Frames.** `UpdateFrame` and bulk `UpdateFrames`, with bulk as a single roll save.
- [-] **1.3.9 Numbering.** *(Replaced by N3 and N6; confirming numbering dropped, D20.)* Setting frame numbers in bulk through `UpdateFrames`; confirming numbering through `UpdateRoll`. Any mapping use cases *(blocked: mapping location)*.
- [ ] **1.3.10 `AttachSleevePhoto`.** Through the blob store, with the signature check.
- [ ] **1.3.12 `CheckIntegrity`.** Validate files, check every version's file exists with the right size, optional full re-hash; report dangling equipment references, unreferenced files and duplicate numbers. `deleted/` is skipped.
- [ ] **1.3.13 `RebuildIndex`.**
- [ ] **1.3.14 `ReconcileExternalChange`.** Re-read the roll, validate, re-index and notify; invalid files are reported, not loaded.
- [ ] **1.3.15 `RenameRoll`.** Checks the new ID is free, renames through the repository, re-indexes and notifies (D10).
- [ ] **1.3.16 `DeleteVersion`, `DeleteFrame` and `DeleteRoll`.** Each saves the roll first, then hands the JSON and files to the holding area. Deleting the default version unsets `defaultVersion`. `DeleteRoll` only when the roll has no frames. All require the roll's version (D12, D13).

### HTTP API

- [ ] **1.4.2 Archive and equipment routes.**
- [ ] **1.4.3 Remaining roll and frame routes.** Bulk frame edits, `sort` and filter query parameters, `POST /api/rolls/{rollId}/rename`, `DELETE` for frames, versions and rolls (`If-Match` required).
- [-] **1.4.5 Mapping routes** *(Dropped: the UI works numbers out, D19.)* *(blocked: mapping location)*.
- [ ] **1.4.6 Sleeve route.**
- [ ] **1.4.7 SSE route** (`/api/changes`; `/api/events` is the archive's events, U12a).
- [ ] **1.4.8 Maintenance routes.**

### File watcher

- [ ] **1.5.1 Watcher adapter.** chokidar on the archive folder, ignoring `deleted/` and the service's own writes and renames, calling `ReconcileExternalChange` for changed `roll.json` files. Integration test against a temp archive.

### Web UI

- [ ] **1b.1 Live updates.** An SSE hook that invalidates affected queries.
- [ ] **1b.2 First-run setup.** Shown when the archive isn't initialised: name, author, copyright, first lab and its scan direction.
- [ ] **1b.3 Roll creation in full.** *(Pickers that create equipment: U9–U11.)* Camera, lens and film pickers that can create equipment; roll number suggestion (D8); clash shown before submitting.
- [ ] **1b.4 Robust upload.** Files not matching the lab pattern are listed and skipped; parallel uploads with retries; a 409 for a duplicate counts as done, so re-dropping a folder completes an interrupted import; leftover frames with no versions can be deleted.
- [-] **1b.5 Numbering.** *(Replaced by N1–N6.)* Thumbnails in scan order; anchor and direction, skips and overrides, proposed numbers and warnings; save with one bulk update. A reusable component for 1c.4. *(Blocked: mapping location.)*
- [-] **1b.6 Rolls grid.** *(Replaced by U3, U4 and U6.)* Sleeve photo or first frame, filters, sort (D9).
- [-] **1b.7 Roll view.** *(Replaced by U5.)* Contact sheet in frame-number order, roll details and sleeve photo; frames with no versions show a placeholder.
- [ ] **1b.8 Frame view.** Large preview, previous/next, resolved metadata with sources, the frame's versions with "Set as default" and delete; arrow keys and Esc.
- [ ] **1b.9 Checkpoint.** Import at least five real rolls, including one scanned in reverse, and browse them.
- [ ] **1c.1 Frame editing.** Title, rating (keys 0–5), tags, notes, location, lens override; inherited values greyed with their source; "set on roll instead" and "clear override".
- [ ] **1c.2 Roll editing.** *(Edit details and its fields: U7–U12c.)* All roll fields and `meta`, equipment pickers, sleeve photo upload, rename (D10), delete when empty (D12).
- [ ] **1c.3 Bulk edit and delete.** *(Selecting frames and setting event, camera, film stock or lens: U14 and U16; tags, location and bulk delete remain.)* Select frames; set tags, location or lens in one save, or delete after confirmation.
- [-] **1c.4 Fix numbering.** *(Replaced by N3–N6.)* The numbering component on an existing roll, then confirm.
- [ ] **1c.5 Conflict handling.** On a 409, reload and re-apply if it doesn't clash; otherwise show what changed.
- [ ] **1c.6 Maintenance page.** Integrity check (quick or full) and index rebuild.
- [ ] **1c.7 End-to-end test.** Playwright against `composeLocal` with a temp archive and fixture scans: first-run setup → import → fix numbering → edit a frame → reload and see it saved. Runs in CI.
- [ ] **1c.8 Checkpoint.** Catalogue a newly arrived roll end to end in the browser without opening a JSON file.

**Done when:** 1c.7 is green in CI and 1c.8 succeeds. That completes Phase 1.
