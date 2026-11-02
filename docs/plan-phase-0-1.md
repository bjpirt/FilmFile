# FilmFile plan: Phase 0 (Foundations) and Phase 1 (MVP: rolls and frames)

*Last updated 2 November 2026. Read alongside `docs/design.md`, especially section 13 (Architecture).*

**Delivery order:** this plan describes what Phases 0 and 1 contain. The work is delivered slice first, as set out in `docs/tasks-phase-0-1.md`: rolls and scans through the API (S1), then a basic UI (S2), then hardening to the standards below (H), then the rest of Phase 1 (P). The "done when" criteria here still apply by the end.

## Outcome

At the end of Phase 1 I can drag a lab's scans into the browser, fix the frame numbering against the negatives, catalogue rolls and frames (camera, lens, film, title, tags, rating, location), and browse everything, with the archive stored as plain JSON and image files on disk and all access going through the FilmFile API service.

## Assumptions taken for this plan

Change them here if they're wrong.

1. **No CLI.** The browser UI is the only client. The API has an interactive docs page for trying endpoints before the UI exists.
2. **Lab scans are imported by browser upload.** The API has no import workflow: a roll is created first, then each scan is uploaded as a new frame. The UI drives the import.
3. **Equipment is proper data from the start.** Choosing a new camera, lens or film in the UI creates it.
4. **The Phase 1 UI includes editing**, not just browsing.
5. **Backup relies on existing machine backups** (e.g. Time Machine) until Phase 4. An integrity check verifies files in the meantime.
6. **Tooling:** pnpm workspaces, Vitest, Hono + `@hono/zod-openapi`, `openapi-typescript` + `openapi-fetch`, React + Vite + TanStack Query, Playwright. All are swappable behind the architecture.

---

## Phase 0: Foundations

### 0.1 Repository and tooling (S)

- pnpm workspace with `apps/backend`, `apps/web` and `packages/contracts` (layout in design section 13.9).
- TypeScript strict with the extra flags listed in `CLAUDE.md`, in a shared `tsconfig.base.json`.
- ESLint (`typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`), Prettier, Vitest with coverage thresholds, and a `pnpm verify` script that runs format check, lint, typecheck and tests.
- **Layer rules** enforced by `eslint-plugin-boundaries`:
  - `domain/` imports nothing outside `domain/`.
  - `application/` imports only `domain/`.
  - `adapters/` imports `application/` and `domain/`, never `composition/`.
  - Only `main.ts` imports `composition/`.
  - `apps/web` imports only `@filmfile/contracts`.
- Pin the Node LTS version in `.nvmrc` and `engines`.

**Done when** CI passes on the skeleton, and a deliberate wrong-way import (e.g. `domain` importing an adapter) fails the build.

### 0.2 Service skeleton and composition (S)

- `Result<T, E>` type and helpers, and the base domain error types (`NotFound`, `ValidationFailed`, `ConcurrencyConflict`, `AlreadyExists`, `MappingInvalid`).
- `ArchiveContext` type (`{ archiveId }`).
- `Clock` and `IdGenerator` ports, with node and fixed/sequential adapters.
- `composeInMemory()` and `composeLocal(config)` returning the wired application and HTTP app. `main.ts` reads config (archive path, cache directory, host, port) and starts the server.
- A health endpoint and the OpenAPI document served at `/api/openapi.json` with a docs page.

**Done when** `GET /api/health` responds from both compositions, and the docs page loads.

### 0.3 Contracts package (S)

- `@filmfile/contracts`: the Zod schemas for API requests and responses, starting with archive and health.
- A build step that emits the OpenAPI spec, and generates the typed client with `openapi-typescript`. The web app imports the client from this package.

**Done when** the web app makes a typed call to the health endpoint.

### 0.4 Repository ports and adapters (M)

- Port interfaces: `ArchiveRepository`, `RollRepository`, `EquipmentRepository`. `RollRepository` also has `rename(ctx, id, newRollId, expectedVersion)`, which moves the roll's folder, and `delete(ctx, id, expectedVersion)` for empty rolls, which moves the folder into the holding area.
- **Version tokens:** every read returns `{ value, version }`. `save(ctx, value, expectedVersion)` returns `ConcurrencyConflict` if the stored version differs. `create` returns `AlreadyExists` if present.
- **In-memory adapters** for all three.
- **Filesystem adapters:**
  - Persistence Zod schemas for `archive.json`, `roll.json` and equipment files, with `schema: 1` and an empty migration registry.
  - Stable serialisation (fixed key order, 2-space indent, trailing newline), so an unchanged record is byte-identical.
  - Writes: per-file lock (lock files in the cache directory), version check (version = hash of the file bytes), temp file in the same directory, fsync, rename.
  - Invalid files on read return a typed error naming the file and field.
- **Contract test suites** for each repository port, run against both the in-memory and filesystem adapters.

**Done when** the contract suites pass for both adapters, including: a stale version is rejected, concurrent saves serialise, a simulated crash between temp write and rename leaves the original intact (filesystem only), and round-trip output is byte-stable.

### 0.5 Fixtures (S)

- A generator that creates small lab-style JPEGs with sharp, each with its frame number drawn on it, named `BBBBNNNN.jpg`.
- Fixture sets: scanned head to tail, tail to head, a lab-skipped frame, starting at `00`, and one containing a `12A`.
- Helpers that create a temp archive per test, and small test-data builders (`aRoll()`, `aFrame()`).

### 0.6 Quality and security baseline (M)

- **CI pipeline** (GitHub Actions, pinned to commit SHAs, `permissions: contents: read`): frozen-lockfile install, `pnpm verify`, build, Playwright, dependency audit, gitleaks, and CodeQL or Semgrep.
- **pnpm supply-chain settings** in `pnpm-workspace.yaml`: `minimumReleaseAge` (at least 3 days), `allowBuilds` for `sharp`, `better-sqlite3` and `esbuild` only, `strictDepBuilds`, `blockExoticSubdeps`. Dependabot or Renovate configured.
- **Pre-commit hook** with lint-staged (format and lint staged files only).
- **HTTP security middleware**, in place before any real endpoint exists: Host allow-list, Origin check, JSON content-type requirement, security headers, and an error handler that never leaks internals.
- **Safe path helper** in the filesystem adapter that rejects absolute paths, `..` and anything resolving outside the archive or cache root, with tests.

**Done when** API tests prove that a wrong `Host`, a foreign `Origin` and a missing content type are rejected with 403/415, path traversal attempts fail in the helper's tests, and the full CI pipeline is green.

---

## Phase 1: MVP, rolls and frames

### Persistence format for Phase 1

These are the filesystem adapter's file formats (design sections 4–5). The domain and API models are separate but close in shape.

```
archive/
  archive.json
  equipment/
    cameras/nikon-fe.json
    lenses/nikkor-50-1.8-ais.json
    films/kodak-portra-400.json
  rolls/
    2026/
      2026-014/
        roll.json
        sleeve.jpg            # optional
        frames/
          Q2P7RM4K/           # a frame: the last 8 characters of its ULID
            8F3WXB1C/         # a version, likewise
              12340014.jpg    # the lab scan, original name
```

**archive.json**

```json
{
  "schema": 1,
  "id": "01JC8Y…",
  "name": "Ben's film archive",
  "meta": {
    "author": "Ben",
    "copyright": "© Ben. All rights reserved.",
    "licence": "all-rights-reserved"
  },
  "labs": {
    "local-lab": {
      "name": "Local lab",
      "direction": "down",
      "filePattern": "^(?<batch>\\d{4})(?<scan>\\d{4})\\.jpe?g$"
    }
  },
  "defaultLab": "local-lab"
}
```

**roll.json**

```json
{
  "schema": 1,
  "id": "01JC8Z7K3M…",
  "roll": "2026-014",
  "developed": { "lab": "local-lab", "batch": "1234", "date": "2026-10-20" },
  "shot": { "from": "2026-09-28", "to": "2026-10-12" },
  "sleeve": { "binder": 3, "page": 14, "photo": "sleeve.jpg" },
  "notes": "Autumn walks",
  "meta": {
    "camera": "nikon-fe",
    "lens": "nikkor-50-1.8-ais",
    "film": "kodak-portra-400",
    "tags": ["autumn"]
  },
  "numbering": { "confirmed": false },
  "frames": [
    {
      "id": "01JC8Z9Q2P…",
      "number": "23",
      "title": "Mill pond, early fog",
      "rating": 4,
      "meta": {
        "lens": "nikkor-105-2.5",
        "tags": { "add": ["fog"] }
      },
      "defaultVersion": "01JC8ZB7TQ…",
      "versions": [
        {
          "id": "01JC8ZB7TQ…",
          "file": "frames/Q2P7RM4K/8F3WXB1C/12340014.jpg",
          "lab": { "lab": "local-lab", "batch": "1234", "scan": 14 },
          "sha256": "9f2c…",
          "bytes": 1843021,
          "width": 3089,
          "height": 2048,
          "added": "2026-10-21T19:02:11Z"
        }
      ]
    }
  ]
}
```

**Field rules**

- **Inheritable `meta` fields** (archive, roll and frame level): `camera`, `lens`, `film`, `location`, `tags`, `author`, `copyright`, `licence`.
- **Frame-only:** `id`, `number`, `title`, `rating` (0–5), `notes`, `defaultVersion` (optional version ID; when unset the newest version is shown), `versions` (may be empty).
- **Version:** `id`, `file`, `lab` (for lab scans), `sha256`, `bytes`, `width`, `height`, `added`. No `kind` field. Low-res display images are generated previews in the cache, not versions. Phase 1 has only `lab-scan`; the schema is a union by `kind` so Phase 2 adds members.
- **Roll-only:** `id`, `roll`, `developed`, `shot`, `sleeve`, `notes`, `numbering`. Whether `numbering` also records the mapping used is an open question.
- `number` is a string, or `null` for a skipped or unidentified scan.
- `frames` uses the `versions` list from day one, so Phase 2 adds entries without a format change.

**Equipment** (one file each; slug = file name): camera (`make`, `model`, `format`, `notes`), lens (`make`, `model`, `focalLength`, `maxAperture`, `mount`, `notes`), film (`make`, `name`, `iso`, `process`, `format`, `notes`).

---

### Milestone 1a: Domain, use cases and API

Everything works through the API and its docs page. No UI yet.

#### 1.1 Domain (M)

- Types: `Archive`, `Roll`, `Frame`, `Version`, `FrameNumber`, `Meta`, `Mapping`, `Equipment`.
- **Frame numbers:** parse and format `"00"`, `"0"`, integers, `"12A"`, `"14-15"`. Numeric arithmetic is only defined for `00`, `0` and integers (`"00"` = −1).
- **Mapping engine** (pure). Given scans sorted by scan index and a mapping:
  - A scan in `skips` gets `null`.
  - A scan in `overrides` gets that number exactly; overrides don't affect counting.
  - Otherwise, take the nearest anchor at or before the scan: `frame = anchor ± (scan − anchor.scan)`, `+` for `up`, `−` for `down`. Skipped and overridden scans still count as positions.
  - Anchors must be numeric. Warnings (not errors): duplicate numbers and below `00`.
- **Remap:** applying a new mapping updates frame numbers only; frames keep IDs and metadata because they follow their scans.
- **Resolver with provenance:** `archive.meta` → `roll.meta` → `frame.meta`, equipment slugs resolved to records. Scalars replace, maps merge, arrays replace, `{ add, remove }` modifies, `null` clears. Every resolved value records its source layer and ID.
- **Invariants:** rating 0–5, roll numbers unique, frame and version IDs unique within a roll, no two versions in a roll with the same SHA-256, `defaultVersion` (if set) references a version of that frame.

#### 1.2 Remaining ports and adapters (M)

- `BlobStore`: write-once `put` (streaming, size-limited, returns SHA-256 and bytes), `get`, `stat`. Filesystem adapter writes into the version's own folder (`frames/<frame>/<version>/`), refusing to overwrite. In-memory adapter for tests. Contract suite for both.
- `HoldingArea`: receives a deleted frame (moves its frame folder and writes its JSON, with the roll it came from, into a dated folder under `deleted/`) and a deleted roll (moves the whole folder). Never deletes. In-memory adapter for tests. Contract suite.
- `CatalogueIndex`: SQLite adapter (`better-sqlite3`, in the cache directory) with tables for rolls, frames, frame tags and equipment; upsert a resolved roll, query, rebuild. In-memory adapter. Contract suite.
- `ImageInspector`: reads pixel dimensions from an image's header, with sharp's input pixel limit. sharp adapter and a fake for tests. Contract suite.
- `PreviewProvider`: sharp adapter producing a 400 px thumbnail and a 2048 px preview as WebP, keyed by SHA-256 and cached; generated lazily. A trivial in-memory adapter for tests.
- `Notifier`: SSE adapter; a recording adapter for tests.

#### 1.3 Use cases (L)

All take `ArchiveContext` and return `Result`. Each one that writes also updates the index and notifies.

| Use case | Notes |
|---|---|
| `InitialiseArchive`, `GetArchive`, `UpdateArchive` | First run creates `archive.json`; update covers meta and labs |
| `ListEquipment`, `CreateEquipment` | |
| `CreateRoll`, `UpdateRoll`, `GetResolvedRoll`, `ListRolls` | `CreateRoll` requires an explicit roll number. `ListRolls` queries the index with filters (year, camera, film, tag) and sorts by roll number (default) or shot date |
| `RenameRoll` | Changes the roll number: checks it's free, moves the folder, re-indexes. The ULID is unchanged |
| `CreateFrame` | Appends a frame (JSON: frame number and other fields optional) to an existing roll. No version token needed: the service locks the roll and appends |
| `AddVersion` | Uploads one file as a version of a frame and records its pixel dimensions. Phase 1 takes lab scans only, with the lab and file name; rejects names not matching the lab pattern, files over 200 MB, and files whose signature isn't an allowed image type. Appends under the roll's lock, without a version token. A file whose hash is already in the roll returns `AlreadyExists` with the existing frame and version, so retries are safe |
| `UpdateFrame`, `UpdateFrames` | Single and bulk edits, including frame numbers; bulk is one roll save |
| `DeleteVersion`, `DeleteFrame`, `DeleteRoll` | Explicit deletes into the holding area; nothing is permanently deleted. Each saves the roll first, then moves the JSON and files to `deleted/`. Deleting the default version unsets `defaultVersion`. A roll can be deleted only when it has no frames |
| Mapping use cases | Depend on where the mapping engine lives (open question). Confirming numbering is an `UpdateRoll` |
| `AttachSleevePhoto` | Stores the sleeve photo through the blob store |
| `GetThumbnail`, `GetOriginal` | Stream a version's thumbnail (small or large, generated on first request and cached by content hash) and its original, both addressed by version ID |
| `CheckIntegrity` | Validate all files, check every version's file exists with the right size; optional full re-hash; report dangling equipment references, unreferenced files and duplicate numbers |
| `RebuildIndex` | Rebuild the index from the repositories |
| `ReconcileExternalChange` | Called by the watcher: re-read the changed roll, validate, re-index, notify; invalid files are reported, not loaded |

#### 1.4 HTTP API (M)

Hono with `@hono/zod-openapi`. Every route parses with the contracts schemas, calls one use case, and maps errors: `NotFound` → 404, `ValidationFailed` / `MappingInvalid` → 422, `ConcurrencyConflict` / `AlreadyExists` → 409.

```
GET    /api/health
GET    /api/openapi.json                     docs page at /api/docs

GET    /api/archive                          PUT /api/archive (initialise), PATCH /api/archive
GET    /api/equipment/{kind}                 POST /api/equipment/{kind}

GET    /api/rolls?year=&camera=&film=&tag=&sort=roll|shot
POST   /api/rolls
GET    /api/rolls/{rollId}                   resolved roll + ETag
PATCH  /api/rolls/{rollId}                   If-Match required
PATCH  /api/rolls/{rollId}/frames/{frameId}  If-Match required
PATCH  /api/rolls/{rollId}/frames            bulk, If-Match required
DELETE /api/rolls/{rollId}                   only when empty, If-Match required
POST   /api/rolls/{rollId}/frames            JSON → new frame (no image)
DELETE /api/rolls/{rollId}/frames/{frameId}  If-Match required
POST   /api/rolls/{rollId}/frames/{frameId}/versions?lab=&file=   raw image body → new version
DELETE /api/rolls/{rollId}/frames/{frameId}/versions/{versionId}   If-Match required
GET    /api/rolls/{rollId}/frames/{frameId}/versions/{versionId}/file   original, read-only
GET    /api/rolls/{rollId}/frames/{frameId}/versions/{versionId}/thumbnail?size=small|large   400 px or 2048 px WebP
PUT    /api/rolls/{rollId}/sleeve            upload sleeve photo
POST   /api/rolls/{rollId}/rename            { roll }, If-Match required

(mapping routes depend on where the mapping engine lives)

GET    /api/events                           server-sent events

POST   /api/maintenance/check                { full?: boolean }
POST   /api/maintenance/reindex
```

#### 1.5 File watcher (S)

`chokidar` on the archive folder, ignoring `deleted/`. A change to a `roll.json` not made by the service calls `ReconcileExternalChange`. The service ignores events caused by its own writes (by comparing version tokens), including the folder move from a rename.

**Milestone 1a is done when** the use-case tests (in-memory) and HTTP tests pass, and I've initialised an archive, created a roll, created frames and uploaded real scans as their versions through the API docs page, renumbered them, and run the integrity check successfully.

---

### Milestone 1b: Web UI, import and browse

React + Vite + TanStack Query, using only the generated client from `@filmfile/contracts`. SSE events invalidate cached queries so changes appear live.

- **First run:** a setup screen when the archive isn't initialised (name, author, copyright, first lab and its scan direction).
- **Import:**
  1. Choose an existing roll, or create one first (roll number, camera, lens and film pickers). The roll number field starts empty; the UI offers the next free number in a year as a one-click suggestion, worked out from the roll list.
  2. Drag the lab's folder (or files) onto the page. For each scan, a frame is created and the scan uploaded as its version, with progress; files not matching the lab pattern are listed. Dropping the folder again after an interruption completes the import, since duplicates are recognised by hash.
  3. **Numbering:** thumbnails in scan order with proposed frame numbers. Set the starting anchor and direction, mark skips and overrides, see warnings live, and save the numbers with one bulk update.
- **Rolls:** a grid of rolls (sleeve photo or first frame), filterable by year, camera, film and tag, sortable by roll number or shot date, with a "numbering not confirmed" badge.
- **Roll:** a contact sheet in frame-number order, with roll details and the sleeve photo alongside.
- **Frame:** a large preview of the default version with previous/next, the frame's versions with "Set as default", and resolved metadata where every value shows its source (frame, roll, archive). Keyboard: arrows to move, Esc back.

**Milestone 1b is done when** I've imported at least five real rolls through the browser, including one the lab scanned in reverse, and can browse them all.

---

### Milestone 1c: Editing and maintenance in the UI

- **Frame editing:** title, rating (keys 0–5), tags, notes, location, lens override. Inherited values show greyed with their source; editing creates an override, with "set on roll instead" and "clear override" actions.
- **Roll editing:** all roll fields and roll `meta`, with equipment pickers that can create new items; upload a sleeve photo; rename the roll number as a separate, confirmed action.
- **Bulk edit:** select frames on the contact sheet and set tags, location or lens in one save.
- **Fix numbering:** the same mapping screen as import, on an existing roll, then confirm.
- **Conflict handling:** on a 409, reload the roll, re-apply the change if it doesn't clash, otherwise show what changed.
- **Maintenance:** a small page to run the integrity check (quick or full) and rebuild the index.

**Milestone 1c (and Phase 1) is done when** I catalogue a newly arrived roll end to end in the browser, from upload to confirmed numbering and metadata, without opening a JSON file.

---

## Testing approach

- **Domain:** table-driven unit tests for frame numbers, the mapping engine (up, down, `00`, anchors, overrides, skips, warnings), and the resolver (every merge rule, provenance).
- **Use cases:** through `composeInMemory`, covering every use case's success and error paths. This is the bulk of the behaviour tests.
- **Port contracts:** shared suites run against in-memory and real adapters for every port.
- **HTTP:** `app.request` tests against an in-memory composition: status codes, ETag / If-Match, validation errors, frame uploads and duplicates.
- **End to end:** Playwright against `composeLocal` with a temp archive and fixture scans: first-run setup → import → fix numbering → edit a frame → reload and see it saved.

## Out of scope for Phases 0–1

A CLI, raws and hi-res masters, multiple versions per frame, the NegPy integration, crop and rotate, events, `_folder.json`, a domain event bus, S3 backup and sync, workflows, the gallery, and authentication (localhost only).

## Risks and mitigations

- **Lab file names vary.** The pattern is configurable per lab, and unmatched files are listed and skipped before upload.
- **Large uploads in the browser.** One file per request with retries; an interrupted import is completed by uploading again, because scans already in the roll are recognised by hash.
- **`sharp` native install problems.** Pin a version and check in CI on macOS.
- **Index drift.** All writes go through use cases that update the index; the watcher and rebuild cover anything else.
- **Mapping layers between domain, files and API feels like duplication.** Keep shapes close in Phase 1 and the mapping thin; the separation pays off when formats evolve.

## Open questions

- Where the mapping engine lives: in the service behind a stateless endpoint, in a shared package, or in the UI. To be decided once more of the app is built.
- Whether `roll.json` records the mapping used to number a roll, so it can be adjusted later, or only the resulting frame numbers.
- Upload limits for raws and 16-bit TIFF masters (Phase 2). Lab scans are limited to 200 MB per file.
