# FilmFile — Design

*Status: design agreed, not yet built. Last updated 2 November 2026.*

A local-first tool for organising and cataloguing film photographs: physical negatives in archival sleeves, the lab's low-res scans, my own hi-res camera scans, and the edits and exports made from them. It backs up and syncs through S3, and publishes selected images to a web gallery and other sites.

The phased roadmap is in section 14, and the detailed plan for the first phases is in `docs/plan-phase-0-1.md`.

---

## 1. Goals and non-goals

**Goals**

- Catalogue every frame and link it back to the physical negative (roll, sleeve, frame number).
- Organise by **roll** (physical) and by **event** (what happened), with events that can nest.
- Keep **multiple versions** of each photograph (lab scan, raw camera scans, edits, exports) with their lineage.
- Store all metadata as **JSON on the filesystem**, with layered overrides.
- Run **workflows** when things happen in the archive (back up to S3, publish to a gallery or other sites).
- Back up to S3 and use S3 to **sync between devices**.
- Integrate with an **external editor** (currently NegPy) without depending on it.

**Non-goals**

- Image editing. The only manipulations are **simple crop and rotate**, stored non-destructively. Conversion and editing happen in the external editor.
- Hand-editing metadata files. The tool is the only intended writer.
- A hosted, multi-user service. It is single-user and local-first. Central coordination may come later.

---

## 2. Principles and invariants

1. **The filesystem is the source of truth.** JSON files plus image files are the archive. Every database is a cache that can be rebuilt by scanning the tree.
2. **The API service is the only writer.** Every write goes through a use case and a repository port: it's validated, saved only if the record hasn't changed since it was read (version token), atomic, and serialised with a stable key order so unchanged data produces byte-identical files.
3. **Originals are never modified or permanently deleted.** Lab scans, raws and editor exports are only ever added. An edit creates a new version, never an overwrite. Deleting a frame or roll moves its files into the archive's `deleted/` holding area; only I empty it.
4. **Never write metadata into raws.** NegPy identifies files by content hash, so changing EXIF changes the hash. Catalogue metadata is stamped into exports only.
5. **Frame identity lives in `roll.json`, not in paths.** Each frame has a folder, and each version a folder inside it, named by the end of their ULIDs; files keep their original names. Renumbering frames changes metadata only; files never move.
6. **Stable IDs.** Archives, rolls, frames, versions and events have ULIDs, so renaming a roll or event doesn't break links, sync or published URLs.
7. **Catalogue and operational state are separate.** `roll.json` holds the catalogue; `.state.json` holds workflow state, which changes far more often.
8. **Nothing destructive by default.** Deleting, unpublishing and similar actions are explicit, separate operations. Deletes are recoverable by hand from `deleted/`.
9. **Caches live outside the archive.** Thumbnails, previews, the SQLite index and lock files sit in an OS cache directory and are never synced.
10. **External changes are validated.** Files changed by sync (or the odd manual fix) are re-validated by the watcher; invalid files are flagged, not loaded.

---

## 3. Domain model

```
Archive
 ├─ Equipment   cameras, lenses, films (referenced by slug)
 ├─ Event       what happened: name, dates, place; nests via parent
 └─ Roll        the physical roll: development, sleeve location
     └─ Frame   one photograph: frame number, title, rating, events
         └─ Version   one file: lab scan, raw, master, edit or export, with lineage
               └─ Attachments   editor recipe sidecars (e.g. .negpy)
```

- **Roll:** identified by my roll number (written on the sleeve) in the form `YYYY-NNN`, e.g. `2026-014`. `YYYY` is the year the roll was shot; `NNN` is the next free number in that year when the roll is catalogued, so a roll catalogued late gets a later number than rolls shot after it. Rolls aren't numbered when the film is loaded. The roll's folder is `rolls/YYYY/YYYY-NNN/`. The lab batch is metadata.
  - The API never invents a roll number: creating a roll requires one. The UI suggests the next free number for the year but never fills it in for you.
  - Lists sort by roll number by default, or by shot date when chosen. Roll-level shot dates are optional and kept for reference; within a roll, frame-number order is shot order.
  - A roll number can be changed only by an explicit rename, which checks the new number is free and moves the roll's folder. The roll's ULID doesn't change, so links survive. Files inside the folder never move relative to it.
- **Frame:** identified by the **frame number printed on the film**, as free text of up to 9 characters: `"0"`, `"23"`, `"00"`, `"-1"`, `"12A"`, or `"14-15"` for a panoramic frame spanning two numbers. `null` for a scan that's not yet identified. Frames sort naturally: by leading number (negatives first), then as text. 120 film uses position on the roll. A frame holds metadata and zero or more versions; a frame with no versions is valid (e.g. a frame the lab skipped, catalogued from the sleeve). `defaultVersion` optionally names the version to show; when unset, the newest version is shown.
- **Version:** a file with a ULID, a content hash, its pixel dimensions and parents. Versions have no `kind`: a version is a version, and the frame's `defaultVersion` decides which one is shown. Low-res display images are generated previews in the cache, never versions. `defaultVersion` and `parents` refer to version IDs, never paths. Phase 2 adds raws, masters (editor exports), edits and exports; how the service tells them apart where behaviour differs (e.g. never writing metadata into raws) is an open question (section 15). **`parents` is a list**, since a master may come from several raws (brackets, stitched sections, trichrome).
- **Event:** a named happening with optional dates, location and parent event. Rolls and frames belong to events (section 7).

---

## 4. Archive layout

```
archive/
  archive.json                     # archive-wide defaults and lab config
  equipment/
    cameras/nikon-fe.json
    lenses/nikkor-50-1.8-ais.json
    films/kodak-portra-400.json
  deleted/                         # holding area for deleted frames and rolls; emptied by hand
    2026-11-02T101500Z-frame-01JC8Z9Q2P…/
      frame.json                   # the frame entry and which roll it came from
      Q2P7RM4K/…                   # the frame's folder, moved as it was
  events/
    iceland-2026.json
    jokulsarlon-day.json           # parent: iceland-2026
  rolls/
    2026/
      _folder.json                 # optional defaults for a group of rolls (later phase)
      2026-014/
        roll.json                  # roll, frames and versions
        .state.json                # tool-owned workflow state
        sleeve.jpg                 # sleeve on a lightbox: the contact sheet
        frames/
          Q2P7RM4K/                # one folder per frame: the end of its ULID
            8F3WXB1C/  12340001.jpg               # one folder per version, original names
            K0D9TZ6E/  DSC_4821.NEF, DSC_4821.negpy
            V5M2QH8A/  DSC_4821.tif, 3f9a….negpy  # an export and its recipe snapshot
```

- A folder per version means a file never needs a kind to decide where it goes, files with the same name (such as a re-exported master) never clash, and a file's sidecars sit beside it. Deleting a frame or version moves one folder.
- Folder names are the last 8 characters of the ULID (its random part), unique within their parent folder. They are never used to find anything: `roll.json` records each version's path.
- Folders are named by ID, not frame number, so renumbering never moves files.
- NegPy doesn't need the raws in one folder: it can build a virtual roll from frames anywhere, and keys its edits by file content, so files can move.
- Every file is listed in `roll.json` with its SHA-256 and size, so corruption, outside edits and stray files are detectable.
- If browsing by frame number or by kind in Finder is ever wanted, the tool can generate a read-only folder of symlinks.

---

## 5. File formats

All files are JSON, carry `"schema": <n>`, and validate against Zod schemas owned by the filesystem adapter (which also generate JSON Schemas for reference). Readers migrate older schema versions in memory; files are rewritten in the current version the next time they're saved. A file that can't be read (not valid JSON, not matching its schema, or written by a newer version of FilmFile) is reported, not allowed to hide the rest: the roll list names the roll and the problem, and the file is never changed or deleted. These persistence schemas are separate from the domain model and the API contracts (section 13.3).

- **archive.json:** `id`, `name`, `meta` (archive-wide defaults), `labs` (per lab: name, default scan `direction`, `filePattern`), `defaultLab`, and workflow settings.
- **roll.json:** roll fields, roll `meta`, and the `frames` array, each frame holding its own fields, `meta`, `events` and `versions`. A full example is in `docs/plan-phase-0-1.md`.
- **Equipment:** one file per item; the slug is the file name.
- **Event:** `id`, `name`, optional `parent` (event slug), `dates`, `notes`, and `meta` defaults (e.g. `location`).
- **.state.json:** per roll, keyed by frame ID and version, holding workflow outcomes (backed up, published URL). It can be deleted; the tool re-checks what's done.

Version entries (from Phase 2) look like:

```json
{
  "id": "01JD2K4F8R…",
  "file": "frames/Q2P7RM4K/V5M2QH8A/DSC_4821.tif",
  "parents": ["01JD2J9X1B…"],
  "editor": { "name": "NegPy", "version": "0.54" },
  "recipe": "frames/Q2P7RM4K/V5M2QH8A/3f9a….negpy",
  "transform": { "crop": [0.02, 0.01, 0.98, 0.99], "rotate": 0 },
  "sha256": "a41b…",
  "bytes": 182334021,
  "width": 8256,
  "height": 5504,
  "added": "2026-10-31T21:10:00Z"
}
```

---

## 6. Metadata layering

**Inheritable fields** live in a `meta` object, which has the same shape at every level: `camera`, `lens`, `film`, `location`, `tags`, `author`, `copyright`, `licence` (more may be added).

**Resolution order, general to specific:**

`archive` → `_folder` (outermost first; later phase) → `roll` → events (each event's ancestors first, then the event) → `frame` → version

Equipment slugs resolve to their records, whose fields can be overridden by more specific layers.

**Merge rules**

| Value | Rule |
|---|---|
| Scalar | The more specific layer replaces it. |
| Map | Merged key by key. |
| Array | Replaces the inherited list. |
| `{ "add": [...], "remove": [...] }` | Modifies the inherited list. |
| `null` | Clears the inherited value. |

- **Version-level overrides are narrow:** scan settings, licence, and transforms (crop and rotate).
- **Multiple events setting the same field:** the frame's event order decides (first wins), and the tool flags the clash.
- **Provenance:** the resolver records which layer and ID set each value. The UI shows it ("lens: Nikkor 105mm — frame"), and the resolved record is exactly what workflows and exported EXIF/XMP use.
- **Workflow settings** layer the same way.

---

## 7. Events

- An event file can name a `parent`, forming a **tree** (one parent per event). Validation rejects cycles and warns when a child's dates fall outside its parent's. A parent without dates takes its range from its children.
- **Membership is declared on rolls and frames** via `events` (an array to replace, or `{ add, remove }`), layered like any other list. A roll's events are inherited by its frames; frames can override.
- **Membership implies ancestors:** a frame in `jokulsarlon-day` is also in `iceland-2026`. Frames list only their most specific events.
- **Event metadata flows down:** parent event → child event → frame. An event's date range stands in as the approximate shot date for its frames.
- Events never move files. They are views across the archive, built by the index.
- **Events, tags and albums differ:** events say when and where; tags describe content; albums are curated selections for showing and publishing.

---

## 8. Import

### 8.1 Lab scans

Lab scans are low-res JPEGs of every frame named `BBBBNNNN.jpg` (batch, scan index). They're **cropped**, so frame numbers aren't visible, and the lab **sometimes scans from the tail of the roll**.

- The file pattern and default direction are configured per lab in `archive.json`.
- **Numbering is driven from the UI** (D19). Upload numbers new frames in file-name order, carrying on from the roll's highest number, which is right for rolls scanned head to tail. To fix the rest: **renumber** the roll (the first scan is frame N, counting up or down, in plain integers, below zero if need be) with a preview before saving, or **edit one frame's number** (any text, such as `00` or `12A`). The UI works the numbers out; the API stores only the resulting frame numbers, saved together and guarded by the roll's version token. There are no anchors, overrides or skips, and no numbering warnings.
- **The API has no import workflow.** A roll is created first; then each frame is created (JSON, frame number optional), and its lab scan is uploaded (at most 200 MB) as a version of that frame, stored unchanged in the version's own folder. Frames can be added to a roll that already has frames.
- **The UI drives the import:** drag the lab's download folder onto the import page, create a frame and upload its scan for each file, then set the numbering.
- Upload is idempotent: a file whose hash is already in the roll is refused with a reference to the existing frame and version, so an interrupted import is completed by uploading again. An interruption between creating a frame and uploading its scan leaves a frame with no versions, which is valid and can be uploaded into or deleted.
- **Renumbering** changes frame numbers in `roll.json` only. Frames keep their IDs, metadata and versions. There's no "numbering confirmed" state: a roll's numbers are what they are, corrected by editing or renumbering (D20).

### 8.2 Own hi-res scans (camera raws), Phase 2

1. Frames are marked **needs hi-res** while browsing lab scans.
2. The tool produces an ordered **scan list** (e.g. `2026-014: 3, 7, 12A, 23`).
3. Raws are shot in that order and imported as versions of their frames, matched to frames by capture time against the list, using the same anchors-and-exceptions approach.
4. Including the film border is encouraged, so the frame number is visible.
5. A frame may have several raws.

---

## 9. Editor integration (Phase 2)

**Responsibilities:** this tool owns raws, frame assignment, catalogue metadata, ingested exports as versions, and crop and rotate. The editor owns conversion and editing; its recipes are captured as attachments.

**Editor adapters** declare how to open files, where exports land (a watched **inbox folder**), how to match an export to its source, and which sidecars are its recipes. A generic inbox adapter should cover most editors.

**Round trip:** open the roll's raws in the editor (in NegPy, as a virtual roll) → export into the inbox, keeping the raw's name → ingest as a `master` version with `parents` and `editor`, then stamp resolved catalogue metadata into the exported file. Matching falls back from filename to EXIF capture time to asking.

**NegPy specifics**

- Open source (GPL-3), Python + PyQt6. It never modifies source files and keeps edits in its own SQLite database keyed by file hash.
- It writes per-frame **`.negpy` sidecars** on export ("Save on Export") or via "Export Sidecars", and reads them when opening a roll only for frames with no database entry ("Load Edit from Sidecar…" forces it).
- **Recipes are stored twice:** the current sidecar next to the raw, and a hash-named snapshot in the export's version folder, so every export is reproducible.
- **Do not import NegPy code.** Reading its file formats is fine.

---

## 10. Storage, sync and backup

**S3 has three roles:** backup, sync between devices, and hosting the public gallery (in a separate bucket).

| Content | Storage class | Purpose |
|---|---|---|
| JSON, sidecars, recipes, previews, lab scans | S3 Standard or Standard-IA | Sync and quick restore |
| Masters and raws | Glacier Deep Archive | Disaster recovery (12–48 h restore, 180-day minimum) |
| Masters and raws (optional) | Standard-IA as well | Any device can fetch hi-res on demand — **decision open** |

**Device profiles:** a *full* device holds every original; a *browse* device holds JSON and previews and fetches originals on demand.

**Sync**

- Files sync individually, with each file's hash at the last sync recorded, plus a copy of the last-synced `roll.json` as a merge base.
- One side changed: copy it across.
- Both changed a `roll.json`: three-way merge by frame and field. Only a genuine clash (both changed the same field of the same frame) is flagged for resolution.
- Image files never conflict, because versions are only added.

**Security:** a private, versioned bucket (consider Object Lock on originals), per-device access keys scoped to the bucket, server-side encryption by default. The gallery bucket only ever holds web-sized exports.

---

## 11. Workflows (format deferred)

- **Events in the archive trigger workflows:** version added, frame tagged, rating changed, roll completed, and so on. A workflow is a trigger, a filter and a list of steps.
- **Local compute runs workflows**, initially on one designated device. Central coordination may come later.
- **Deterministic job keys:** frame ID + version hash + workflow name + workflow version. Completed jobs are skipped, so steps can be retried and backfilled over the whole archive.
- **Outcomes go in `.state.json`.** The job queue lives in SQLite and is operational only.
- **Built-in actions plus an escape hatch:** S3, export, resize, contact sheet and gallery publish; then run-a-script and webhook.

To decide later: the definition format for triggers, filters and steps.

---

## 12. Web gallery

- A publishing workflow renders a static site from selected frames or albums into a **separate public bucket** behind CloudFront.
- Per-album options: unlisted or public, strip GPS, watermark, show or hide camera and film details.
- Unpublishing is an explicit action that removes those exports.
- Other targets (Flickr, Instagram, the camera repair site) follow the same pattern.

---

## 13. Architecture

### 13.1 Overview

FilmFile is a **core API service** that owns all archive data, plus a **browser UI** that is purely a client of that API. Any future client (a CLI, scripts, a phone app) also goes through the API; nothing else reads or writes the archive.

The service follows **hexagonal architecture (ports and adapters)** so the same core can run locally today and be hosted in the cloud later as **my own single-user instance**, by swapping adapters, not rewriting logic.

```
           inbound adapters                                outbound adapters
        ┌───────────────────┐                        ┌─────────────────────────┐
browser │ HTTP (REST+OpenAPI)│──┐                  ┌──▶│ Catalogue repository    │ JSON files │ (S3)
        └───────────────────┘  │  ┌────────────┐  │   │ Blob store              │ disk       │ (S3)
        ┌───────────────────┐  ├─▶│ Application │──┤   │ Holding area            │ deleted/   │ (S3 prefix)
 disk   │ File watcher      │──┘  │ (use cases) │  ├──▶│ Catalogue index         │ SQLite     │ (SQLite/Postgres)
        └───────────────────┘     └─────┬──────┘  │   │ Preview provider        │ sharp+cache│ (sharp+S3)
                                        │         └──▶│ Notifier, Clock, Ids    │ SSE, node  │
                                  ┌─────▼──────┐      └─────────────────────────┘
                                  │   Domain    │
                                  └────────────┘
```

### 13.2 Layers and dependency rules

The layers are **folders within the service package**, with a lint rule (`eslint-plugin-boundaries`) run in CI that fails the build if an import points the wrong way.

| Layer | Contains | May import |
|---|---|---|
| `domain/` | Entities and value objects (Roll, Frame, Version, FrameNumber, Mapping, Meta), the mapping engine, metadata resolution and provenance, invariants and domain errors. Pure: no I/O, no time, no randomness. | Nothing outside `domain/` |
| `application/` | Use cases, and the **port interfaces** they depend on (`application/ports/`). Orchestrates domain + ports. | `domain/` |
| `adapters/` | Inbound adapters (HTTP, file watcher), which call the application, and outbound adapters (filesystem, SQLite, sharp, node clock and IDs, in-memory). | `application/`, `domain/`, libraries |
| `composition/` | Composition roots that build the object graph for each runtime. | Everything |
| `main.ts` | Reads config, calls a composition root, starts the server. | `composition/` |

The web UI imports only `@filmfile/contracts` (the API schemas and generated client), never the service.

### 13.3 Three distinct models

Each boundary has its own representation, mapped explicitly at the adapter:

- **Domain model** (`domain/`): plain TypeScript types and functions that enforce invariants.
- **Persistence model** (filesystem adapter): the JSON file formats in section 5, defined as Zod schemas with `schema` versions and migrations. Validated on every read and write.
- **API model** (`@filmfile/contracts`): request and response DTOs as Zod schemas, which generate the OpenAPI spec.

In Phase 1 the persistence and domain shapes are deliberately close, so the mapping is thin. Keeping them separate means file formats and the API can evolve without touching the domain.

### 13.4 Ports (Phase 1)

Outbound ports, defined in `application/ports/` and implemented by outbound adapters:

| Port | Responsibility | Local adapter | Cloud adapter (later) |
|---|---|---|---|
| `ArchiveRepository` | Read and save `archive.json` (meta, labs) | JSON file | S3 object |
| `RollRepository` | Get, list, create, save and rename rolls. Every read returns a **version token**; `save(roll, expectedVersion)` fails with `ConcurrencyConflict` if it changed; `create` and `rename` fail if the roll number is taken | JSON files: lock, ETag check, temp file + rename | S3 `If-Match` / `If-None-Match` conditional writes |
| `EquipmentRepository` | Cameras, lenses, films | JSON files | S3 objects |
| `BlobStore` | Write-once storage of image files: `put` (streams, returns SHA-256 and size), `get`, `stat`. Never overwrites | A folder per version in the archive | S3 with Standard-IA / Deep Archive classes |
| `HoldingArea` | Receives deleted versions and frames (their files plus their JSON) and deleted empty rolls (the whole folder), for me to empty by hand. Never deletes | `deleted/` in the archive | S3 prefix |
| `CatalogueIndex` | Read model for listing and filtering: upsert a resolved roll, remove, query, rebuild | SQLite in the cache directory | SQLite or Postgres |
| `PreviewProvider` | Thumbnails and previews by content hash, generated lazily | sharp + cache folder | sharp + S3 cache |
| `ImageInspector` | Reads an uploaded image's pixel dimensions from its header, within the input pixel limit | sharp (exiftool for raws, Phase 2) | same |
| `Notifier` | Tell connected UIs something changed | Server-sent events | Server-sent events |
| `Clock`, `IdGenerator` | Current time; ULIDs | Node | Node |

Inbound adapters in Phase 1:

- **HTTP API**: Hono with `@hono/zod-openapi`. Parses requests with the contracts schemas, calls a use case, maps the result to a response.
- **File watcher** (local only): `chokidar` on the archive; changes made outside the service (e.g. sync) call the *ReconcileExternalChange* use case. The cloud equivalent is S3 event notifications.

There is **no domain event bus yet**: use cases call `CatalogueIndex` and `Notifier` directly. An event-bus port arrives with workflows (Phase 4), when the direct calls become subscribers.

### 13.5 Use cases

Each use case is a class with its dependencies injected through the constructor and a single `execute(ctx, input)` method:

- `ctx` is an **archive context** (`{ archiveId }`). There's only one archive today, but threading it through every use case means a future multi-archive or multi-user setup doesn't require rewiring.
- Use cases return a **`Result<T, E>`** (a small in-house discriminated union, no library) rather than throwing for expected failures. Domain errors (`NotFound`, `ValidationFailed`, `ConcurrencyConflict`, `AlreadyExists`, `MappingInvalid`) are typed, and the HTTP adapter maps them to status codes (404, 422, 409, 409, 422).
- Unexpected errors (I/O failure, bugs) throw and become a 500 with a logged correlation ID.

### 13.6 Dependency injection

**Pure DI**: constructor injection everywhere, no container library and no decorators.

- Each runtime has a **composition root**: a plain, typed function that builds adapters, injects them into use cases, and injects the use cases into the HTTP routes.
  - `composeLocal(config)`: filesystem repositories and blob store, SQLite index, sharp previews, SSE notifier, chokidar watcher.
  - `composeInMemory(overrides?)`: in-memory adapters for every port, a fixed clock and sequential IDs. Used by tests and a possible demo mode. `overrides` swaps individual adapters.
  - `composeCloud(config)`: later, with S3 and cloud adapters.
- Because wiring is ordinary TypeScript, a missing or mismatched dependency is a compile error, not a runtime surprise.
- Ports are interfaces; adapters are classes implementing them. Nothing outside `composition/` constructs an adapter.

### 13.7 Testing strategy

- **Domain:** pure unit tests (table-driven for the mapping engine and the resolver).
- **Use cases:** tested through `composeInMemory`. This is where most behaviour is tested, and it's fast because nothing touches disk.
- **Port contract tests:** one shared test suite per port, run against every adapter (in-memory and filesystem now; S3 later via MinIO or LocalStack). This guarantees adapters are interchangeable, including concurrency behaviour such as a stale version being rejected.
- **HTTP:** Hono `app.request` tests against an in-memory composition, checking status codes, ETags and validation errors.
- **End to end:** a small Playwright suite against `composeLocal` with a temp archive and generated fixture scans.

### 13.8 API

- **REST resources** with an **OpenAPI spec generated from the Zod schemas** in `@filmfile/contracts`, served at `/api/openapi.json` with an interactive docs page at `/api/docs` (useful for trying the API before the UI exists). The docs page's assets are served by the service itself, not a CDN, so the CSP needs no exceptions.
- The web UI uses a **typed client generated from the spec** (`openapi-typescript` + `openapi-fetch`), so it depends only on the API contract.
- The API serves **resolved data**: a roll comes back with every frame's resolved metadata and provenance, plus an `ETag`. Writes require `If-Match` and return 409 on conflict.
- **Image data and metadata have separate endpoints.** Frames are created and edited as JSON (`/api/rolls/{rollId}/frames`). Images are uploaded as versions of a frame, one file per request, with the raw image as the body (`POST /api/rolls/{rollId}/frames/{frameId}/versions?file=…`), with details such as the file name in the query. Phase 1 uploads lab scans only; Phase 2 adds other files through the same endpoint. A raw image body can't be sent by a cross-site form.
- Original files and thumbnails are read through their version (`…/versions/{versionId}/file` and `…/versions/{versionId}/thumbnail?size=small|large`), never by path or hash. Thumbnails are cached by content hash behind the scenes.
- Live updates go over **server-sent events** (`/api/changes`; `/api/events` is the archive's events).

### 13.9 Repository layout

```
apps/
  backend/                 @filmfile/backend — the core API service, which also serves the UI
    src/
      domain/
      application/
        ports/
        use-cases/
      adapters/
        inbound/http/        Hono routes, OpenAPI, DTO ↔ domain mapping
        inbound/watcher/     chokidar
        outbound/filesystem/ repositories, blob store, persistence schemas
        outbound/sqlite/     catalogue index
        outbound/sharp/      preview provider
        outbound/node/       clock, ULID generator
        outbound/sse/        notifier
        outbound/memory/     in-memory implementation of every port
      composition/         composeLocal, composeInMemory
      main.ts
    test/
      contracts/           port contract suites
      fixtures/            generated fixture archives and lab scans
  web/                     @filmfile/web — React UI
packages/
  contracts/               @filmfile/contracts — API schemas, OpenAPI, typed client
```

### 13.10 Stack

| Need | Choice |
|---|---|
| Runtime | Node LTS, TypeScript strict, pnpm workspaces |
| Validation and schemas | Zod (persistence and API schemas), generated JSON Schema and OpenAPI |
| HTTP | Hono + `@hono/zod-openapi` |
| API client | `openapi-typescript` + `openapi-fetch` |
| Images | `sharp` (libvips): WebP thumbnails and previews keyed by hash |
| Metadata, raw previews (Phase 2) | `exiftool-vendored` |
| Index | SQLite via `better-sqlite3`, in the OS cache directory |
| File watching | `chokidar` |
| IDs | ULID |
| Web UI | React + Vite + TanStack Query |
| Tests | Vitest, `fast-check`, Playwright |
| Quality | ESLint (`typescript-eslint` strict type-checked), `eslint-plugin-boundaries`, Prettier |
| S3 (Phase 4) | AWS SDK v3 |

### 13.11 Service behaviour

- Listens on `127.0.0.1` by default. Network or cloud access requires authentication, to be designed with the cloud adapters.
- Serves the built web UI at `/`, so the UI and API share one origin and the Origin check needs no exceptions. In development, Vite proxies `/api` to the service, and the service's allowed UI origin is set to the Vite dev server's through configuration.
- Runs as a background service (launchd on macOS).
- "Open in editor" launches the editor when the UI is on the same machine; otherwise the UI shows the path.
- The UI only displays generated JPEG/WebP previews, since browsers can't show TIFF or raw.
- There is **no CLI** for now. If one is added, it's an API client, not a second writer.

---

## 14. Roadmap summary

| Phase | Outcome |
|---|---|
| 0. Foundations | Monorepo, hexagonal skeleton with layer rules, contracts and OpenAPI pipeline, repository ports with in-memory and filesystem adapters, fixtures |
| 1. MVP: rolls and frames | Upload lab scans in the browser, fix numbering, catalogue and browse in the web UI |
| 2. Versions and hi-res | Raws, NegPy round trip, version lineage, crop and rotate |
| 3. Events | Nested events, membership, event metadata, `_folder.json` |
| 4. Workflows and S3 backup | Workflow engine, with S3 backup as the first workflow |
| 5. Sync | Device sync through S3 with merge |
| 6. Gallery and publishing | Static gallery, then other targets |

**Ideas backlog:** equipment register linked to repair notes, shot-log import from phone apps, auto-matching lab scans against the sleeve photo, central workflow coordination, running on a NAS, a Tauri desktop wrapper.

---

## 15. Open questions

- **Telling versions apart (Phase 2):** versions have no `kind`. When raws and masters arrive, decide how the service knows a version is a raw (never write metadata into it), a master (has parents and a recipe) or a lab scan (has a batch and scan index): an explicit field, or inferred from the file type and fields present (the folder no longer says). The likely answer is an optional `source` attribute recording where the file came from (e.g. lab scan, camera scan, editor export), added when it's first needed.
- **Choosing locations on a map:** a map picker (and showing frames on a map) needs map tiles from an outside service, which means loosening the CSP and calling out to the network. Until then locations are typed or pasted as coordinates (D26).
- **Name clearance:** check the domain, GitHub organisation and UK IPO register for FilmFile, noting the Print File sleeve brand.
- **NegPy sidecars:** confirm the `.negpy` file name and where it's written.
- **Masters in Standard-IA too?** Whether hi-res files should be fetchable from other devices.
- **Workflow definition format.**
- **Other devices:** viewing only, or editing too?

---

## 16. Glossary

- **Roll number:** the roll's label, `YYYY-NNN` (e.g. `2026-014`), written on the sleeve: the year shot and the next free number that year. It can be changed by a rename; the roll's ULID (`RollId` in code) never changes.
- **Frame number:** the number printed on the film rebate beside each frame (e.g. `23`, `12A`); a frame's identity.
- **Lab batch:** the lab's order number, the `BBBB` in `BBBBNNNN.jpg`.
- **Scan index:** the lab's or camera's sequence number for a scan; not the frame number.
- **Master:** a hi-res file exported from the editor.
- **Recipe / sidecar:** the editor's edit settings stored as a file next to the raw.
- **Preview:** a low-res rendition of a version (thumbnail or screen size), generated from the version's file and cached outside the archive. Not a version.
- **Sleeve photo:** the sleeve photographed on a lightbox, used as the roll's contact sheet and to check numbering.
