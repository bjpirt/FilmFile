# FilmFile — Design

*Status: design baseline; implementation is in progress. See the [roadmap](roadmap.md) for shipped work and [technical architecture](technical-architecture.md) for the current code structure. Last updated 6 November 2026.*

A local-first tool for organising and cataloguing film photographs: physical negatives, the lab's low-res scans, my own hi-res camera scans, and the edits and exports made from them. It backs up and syncs through S3, and publishes selected images to a web gallery and other sites.

The phased roadmap is in section 14; the task files under `docs/tasks/` record implementation scope and acceptance criteria.

---

## 1. Goals and non-goals

**Goals**

- Catalogue every frame and link it back to the physical negative (roll and frame number).
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
2. **The API service is the only writer.** Metadata writes go through use cases and repository ports. Versioned roll saves reject stale data, write atomically, and serialize JSON with stable key order so unchanged data produces byte-identical files. Image bytes are written once through `BlobStore` and are never overwritten.
3. **Originals are never modified or permanently deleted.** Lab scans, raws and editor exports are only ever added. An edit creates a new version, never an overwrite. Deleting a frame or roll moves its files into the archive's `deleted/` holding area; only I empty it.
4. **Never write metadata into raws.** NegPy identifies files by content hash, so changing EXIF changes the hash. Catalogue metadata is stamped into exports only (the JPEGs made in `Exports/`, D94).
5. **Frame identity lives in `roll.json`, not in paths.** Frame folders are named by the frame number and ID; version folders by kind and ID (D69). Renumbering a frame or changing a version's kind moves its folder and updates the version paths in `roll.json`; files keep their original names and contents.
6. **Stable IDs.** Archives, rolls, frames, versions and events have ULIDs, so renaming a roll or event doesn't break links, sync or published URLs.
7. **Catalogue and operational state are separate.** `roll.json` holds the catalogue. A per-roll `.state.json` for workflow outcomes is planned; workflows and this file are not implemented yet.
8. **Nothing destructive by default.** Deleting, unpublishing and similar actions are explicit, separate operations. Deletes are recoverable by hand from `deleted/`.
9. **Caches live outside the archive.** Generated previews and other caches stay in an OS cache directory and are never synced. A rebuildable SQLite index is planned but is not implemented yet.
10. **External changes are validated.** The filesystem repository validates `roll.json` against its schema whenever it reads it, and reports unreadable rolls. Image assets are not automatically re-hashed on read. There is no archive watcher (D37); a NegPy folder watcher is planned with the editor integration (FF-114), not implemented yet.

---

## 3. Domain model

```
Archive
 ├─ Equipment   cameras, lenses, films (referenced by slug)
 ├─ Event       what happened: name and date now; parent hierarchy planned
 └─ Roll        the physical roll: development, when it was shot
     └─ Frame   one photograph: frame number, title, rating, event
         └─ Version   one file: lab scan, raw, master, edit or export, with lineage
               └─ Attachments   editor recipe sidecars (e.g. .negpy)
```

- **Roll:** identified by a freeform roll-number label, often `YYYY-NNN` (e.g. `2026-014`). Any non-empty text up to 100 characters is accepted after trimming surrounding whitespace; the exact remaining text is stored. Numbers are unique case-insensitively, with numeric-suffix equivalence as in D76, and lists sort naturally without case (D70, D76, D87). New-roll suggestions and “Re-number rolls…” use the archive-wide pattern in Settings, defaulting to `{year}-{n:3}` (D88).
  - Patterns have fixed text, one minimum-width sequence token, and optional `{year}`, `{month}`, `{day}` tokens from the shot date and `{event}` (the event's slug). Counters reset for the values of date and event tokens present, or are global without date tokens. New-roll suggestions advance after the highest matching value, never reuse gaps, and skip occupied labels. “Re-number rolls…” keeps D74's filed/filtered-out anchors and shot-date order, grouping by the date and event tokens in the pattern. Changing the pattern doesn't renumber rolls until “Re-number rolls…” is run. The API's omitted-number create fallback is unchanged (D88).
  - A new roll must have a shot date with at least a year (D73). If the pattern uses month, day or event, every existing roll needs that precision or an event before the pattern can be saved, and "Re-number rolls…" needs them; creating or editing a roll doesn't enforce it, so rolls can be imported first and given the details later (D88, D89). Importing a folder of roll folders makes a roll of each subfolder with scans, named after it, dated from its name and numbered from the pattern (D90).
  - A new roll's folder is `rolls/<shot year>/<safe roll label>-<ID>/`, where the label is sanitized using D79. Existing folders keep their current parent permanently; a number change renames only the leaf folder (D66, D87). Rolls are found by their `roll.json`, never by the folder's name. The lab batch is in the scans' file names; labs aren't recorded (D35).
  - Lists sort by roll number by default, or by shot date when chosen. Browse Years and "Group by Year" use the shot year (D75). Within a roll, frame-number order is shot order.
  - Until it's **filed**, a roll's number can be changed by hand, or with "Re-number rolls…" for the rolls matching the active Browse filters. It numbers those rolls in shot-date order, after that number-year's filed rolls, while filtered-out rolls keep their numbers (D74–D75). Each changed roll's folder is renamed to match (D66). The roll's ULID doesn't change, so links survive.
  - Marking a roll as filed, once its negatives are in the physical archive, fixes its number for good so its folder is never renamed again (D66, D74). `roll.json` stores `filed: true` only when set; without the field, the roll is unfiled. Roll API responses always include `filed` as a boolean, and `PATCH` can set or clear it (D71).
  - Attempts to change the number of an already-filed roll fail as a validation error (422); 409 remains for a stale version token (D71).
  - The UI shows a padlock after the roll number on its card in the rolls view and in the roll page heading. Individual frame thumbnails and list rows have no padlock. In Edit details the filed number stays visible and has a padlock (D72).
- **Frame:** identified by the **frame number printed on the film**, as free text of up to 9 characters: `"0"`, `"23"`, `"00"`, `"-1"`, `"12A"`, or `"14-15"` for a panoramic frame spanning two numbers. `null` for a scan that's not yet identified. Frames sort naturally: by leading number (negatives first), then as text. 120 film uses position on the roll. A frame holds metadata and zero or more versions; a frame with no versions is valid (e.g. a frame the lab skipped, catalogued from the negatives). `defaultVersion` optionally names the version to show; when unset, the first version is shown (D46). A frame can have its own date shot (D47) and at most one own event (D50), or be marked as in no event even when its roll has one (D98: its `event` is `false`). A frame can be hidden (D99, `hidden: true`, stored only when set): left out of every list of frames and of every site and export, but kept with its roll. FF-104 adds a persistent `toScan` selection: it remains after scanning, but only marked frames without a Raw scan or Final are pending.
- **Version:** a file with a ULID, relative `file` path, content hash, pixel dimensions, `kind` (`scan`, `raw-scan` or `final`) and rotation. The first version is shown unless `defaultVersion` names another. Low-res display images are generated previews in the cache, never versions. The current model does not yet store lineage (`parents`), editor recipes or crop data; those are part of the planned editor workflow. Version IDs, not paths, are used for `defaultVersion`.
- **Event:** currently a flat record with slug, name and optional date; rolls and frames refer to it by slug. Location and parent-event hierarchy are planned (section 7).

---

## 4. Archive layout

Everything FilmFile keeps is in one **FilmFile folder**, chosen once per computer (D57): in the desktop app with the system's folder chooser, otherwise by the service's `FILMFILE_FOLDER` (D63). Only a valid folder opens, an empty one or one with a `Library/`, and a path is never set through the API (D64). Only `Library/`, the archive, and `settings.json` are the source of truth, backed up and synced; the rest is made from them and can be made again. Caches stay in the OS cache folder.

```
FilmFile/
  settings.json  author and copyright, and later what else is set for FilmFile as a whole (D65)
  Library/       the archive, below
  Exports/       one folder of JPEGs per export, made on demand from its selection (D94)
  Sites/         built sites, one folder each, ready to upload (D91, D92)
  Editors/       folders of links for editors: NegPy/, later darktable/ (D51)
```

The archive (`Library/`):

```
Library/
  equipment/
    cameras/nikon-fe.json
    lenses/nikkor-50-1.8-ais.json
    films/kodak-portra-400.json
  deleted/                         # holding area for deleted frames and rolls; emptied by hand
    2026-11-02T101500Z-frame-01JC8Z9Q2P…/
      frame.json                   # the frame entry and which roll it came from
      23-Q2P7RM4K/…                # the frame's folder, moved as it was
  events/
    iceland-2026.json
    jokulsarlon-day.json           # parent: iceland-2026
  exports/
    iceland-2048.json              # an export: its selection of frames and how they're made (D94)
  sites/
    iceland-highlights.json        # a site: its selection of frames and how it's built (D91)
  rolls/
    2026/
      _folder.json                 # optional defaults for a group of rolls (later phase)
      2026-014-K0P3XW2D/           # a roll: its number and ID, renamed as it's renumbered until it's filed (D66)
        roll.json                  # roll, frames and versions
        .state.json                # planned workflow state
        frames/
          1-Q2P7RM4K/              # one folder per frame: its number and the end of its ULID (D69)
            scan-8F3WXB1C/      12340001.jpg               # one folder per version: its kind and ID; original names
            raw-scan-K0D9TZ6E/  DSC_4821.ARW, DSC_4821.negpy
            final-V5M2QH8A/     DSC_4821.tif, 3f9a….negpy  # an export and its recipe snapshot
```

- A folder per version means files with the same name (such as a re-exported master) never clash, and a file's sidecars sit beside it. Deleting a frame or version moves one folder.
- Folder names are a label and the last 8 characters of the ULID (its random part): rolls `<safe roll label>-<ID>` under the shot-year parent for new rolls, frames `<frame number>-<ID>` (`unnumbered-<ID>` without one, the number cleaned to letters, digits and hyphens), versions `<kind>-<ID>`. Roll labels are sanitized using the frame-label rule; the IDs keep names unique, so renumbering can swap names without clashes (D66, D69, D79, D87).
- Frame-number labels keep ASCII letters, digits and hyphens; every other character becomes `_`, and a leading hyphen is prefixed with `_` (D79). Frame folders are created with the first version, not for empty frames. Only this labeled frame/version layout is supported; ID-only folders are not migrated or supported (D80).
- Labels follow renumbering and kind changes; files keep their original names and are never changed. `roll.json` records each version's path, updated in the same save as a rename; a rename cut short isn't recovered automatically. A rename makes backup and sync see the files as new, which matters only for raws renumbered after they're added.
- If a source folder is missing or a destination is occupied, the save fails without changing `roll.json` or overwriting data. Ordinary move/save errors trigger a best-effort rollback; a crash isn't recovered automatically (D81).
- NegPy doesn't need the raws in one folder: it can build a virtual roll from frames anywhere, and keys its edits by file content, so files can move. After a folder path changes, existing links are rebuilt the next time the user explicitly chooses "Open in NegPy" (D82).
- Every file is listed in `roll.json` with its SHA-256 and size, so corruption, outside edits and stray files are detectable.

---

## 5. File formats

All files are JSON, carry `"schema": <n>`, and validate against Zod schemas owned by the filesystem adapter (which also generate JSON Schemas for reference). Readers migrate older schema versions in memory; files are rewritten in the current version the next time they're saved. A file that can't be read (not valid JSON, not matching its schema, or written by a newer version of FilmFile) is reported, not allowed to hide the rest: the roll list names the roll and the problem, and the file is never changed or deleted. These persistence schemas are separate from the domain model and the API contracts (section 13.3).

- **settings.json:** in the FilmFile folder beside `Library/` (D65): `id`, `meta` (archive-wide defaults: author and copyright; a licence later, D42), and later export recipes, site defaults and workflow settings. It never holds the folder's own path, nor values that differ on each computer (D52). Labs aren't stored (D35).
- **roll.json:** roll fields, the optional `filed: true` field (absent means unfiled), roll `meta`, and the `frames` array. A frame's optional `toScan: true` is stored only when marked; absent means false. Each frame also holds its own fields, `meta`, its `event` and `versions`.
- **Equipment:** one file per item; the slug is the file name.
- **Event:** `id`, `name`, optional `parent` (event slug), `dates`, `notes`, and `meta` defaults (e.g. `location`).
- **.state.json:** per roll, keyed by frame ID and version, holding workflow outcomes (backed up, published URL). It can be deleted; the tool re-checks what's done.

The current domain/API version has `id`, `file`, `sha256`, `bytes`, `width`, `height`, `added`, `kind` and `rotate`. In `roll.json`, the default `scan` kind and zero rotation are omitted. A planned Phase 2 version with lineage and recipe metadata could look like:

```json
{
  "id": "01JD2K4F8R…",
  "file": "frames/1-Q2P7RM4K/final-V5M2QH8A/DSC_4821.tif",
  "kind": "final",
  "parents": ["01JD2J9X1B…"],
  "editor": { "name": "NegPy", "version": "0.54" },
  "recipe": "frames/1-Q2P7RM4K/final-V5M2QH8A/3f9a….negpy",
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

### Implemented resolution and FF-101

The current resolver combines archive settings, roll and frame details. Settings contribute `author` and `copyright`; a roll contributes `camera`, `film`, `lens`, its event slug and shot date; a frame can override its own `camera`, `lens`, singular `event` and shot date. A frame cannot set its own film stock (D45). [`GetFrameDetails`](../apps/backend/src/application/use-cases/frames/get-frame-details.ts) builds the archive → roll → frame layers and returns the source of each resolved value.

FF-101 makes a frame's own event a singular `event` slug; `false` marks the frame as in no event (D98), clearing the roll's in the resolved details. The resolved-details response is also singular: a frame event takes precedence over its roll's; otherwise the roll event is returned with its source. If neither is set, the resolved event is omitted. Scalars inherit when omitted, replace when set and clear with `null`. The other currently resolved details are `author`, `copyright`, `camera`, `film`, `lens` and `shot`.

### Planned extensions

The broader target adds `location`, `tags`, `licence`, `_folder` defaults, event-ancestor and version-level layers, plus map merging. These are not part of the current resolver. In the target design, resolution proceeds from archive → outer `_folder` layers → roll → event ancestors and event → frame → version, with more-specific values taking precedence. Workflow settings use a similar model when workflows are implemented.

---

## 7. Events

**Current implementation:** an event is a flat record with a slug, name and optional date. Rolls and frames store one event slug each. A frame's own event overrides its roll's, absent frame event means it inherits the roll's, and `false` puts it in no event (D98). Events do not move files, and pages read event and roll data through repositories because there is no catalogue index yet.

**Planned event model:** an event can name one parent, forming a tree; validation rejects cycles and checks child dates against parent dates. Membership implies ancestors, and event metadata and date ranges flow to frames. The legacy pre-release `events` array is ignored rather than copied to the current singular `event` (D84). Sub-events and ancestor membership remain FF-130.

Events, tags and albums remain distinct concepts: events describe when and where, tags describe content, and albums are curated selections for showing and publishing.

---

## 8. Import

### 8.1 Lab scans

Lab scans are low-res JPEGs of every frame named `BBBBNNNN.jpg` (batch, scan index). They're **cropped**, so frame numbers aren't visible, and the lab **sometimes scans from the tail of the roll**.

- **Labs aren't stored** (D35). Scans are recognised by their file name's shape, as now, kept under their own names, and numbered in file name order; a lab that scanned from the tail is fixed by renumbering.
- **Numbering is driven from the UI** (D19). Upload numbers new frames in file-name order, carrying on from the roll's highest number, which is right for rolls scanned head to tail. To fix the rest: **renumber** the roll (the first scan is frame N, counting up or down, in plain integers, below zero if need be) with a preview before saving, or **edit one frame's number** (any text, such as `00` or `12A`). The UI works the numbers out; the API stores only the resulting frame numbers, saved together and guarded by the roll's version token. There are no anchors, overrides or skips, and no numbering warnings.
- **The API has no import workflow.** A roll is created first; then each frame is created (JSON, frame number optional), and its lab scan is uploaded (at most 200 MB) as a version of that frame, stored unchanged in the version's own folder. Frames can be added to a roll that already has frames.
- **The UI drives the import:** drag the lab's download folder onto the import page, create a frame and upload its scan for each file, then set the numbering.
- Upload is idempotent: a file whose hash is already in the roll is refused with a reference to the existing frame and version, so an interrupted import is completed by uploading again. An interruption between creating a frame and uploading its scan leaves a frame with no versions, which is valid and can be uploaded into or deleted.
- **Renumbering** changes frame numbers in `roll.json` and renames the frame folder; frames keep their IDs, metadata and versions. There's no "numbering confirmed" state: a roll's numbers are what they are, corrected by editing or renumbering (D20, D69).

### 8.2 Own hi-res scans (camera raws)

Every version is a kind (D48): a **Scan**, ready to view at whatever resolution (the lab's low-res scans, or a positive of my own); a **Raw scan**, the negative or slide as scanned, not yet processed; or a **Final**, processed and edited. Single-file uploads as these kinds and changing a version's kind are implemented. Raw scans can be Sony ARW raws or TIFFs, are never written to, and an ARW's thumbnail comes from the preview JPEG it carries. FF-104's persistent scan mark stays set after a Raw scan or Final is added; those frames show “Scanned” with the scanner icon checked and colored with the orange accent, but no longer count as pending. Exporting raw scans for NegPy or Darktable, adding many frames' raw scans or finals at once, and the scan-list workflow below remain planned.

FF-104's scan mark is implemented. The numbered scan-list and matching workflow below (FF-131) is still planned, not part of the current upload flow:

1. Make an ordered list from frames marked **to scan** that still lack a Raw scan or Final. The mark is persistent; adding a Raw scan or Final changes the thumbnail to “Scanned” but does not remove the selection.
2. The tool produces an ordered **scan list** (e.g. `2026-014: 3, 7, 12A, 23`).
3. Raws are shot in that order and imported as versions of their frames, matched to frames by capture time against the list, using the same anchors-and-exceptions approach.
4. Including the film border is encouraged, so the frame number is visible.
5. A frame may have several raws.

---

## 9. Editor integration (planned)

**Responsibilities:** this tool owns raws, frame assignment, catalogue metadata, ingested exports as versions, and crop and rotate. The editor owns conversion and editing; its recipes are captured as attachments.

**Editor adapters** declare how to open files, where exports land (a watched **inbox folder**), how to match an export to its source, and which sidecars are its recipes. A generic inbox adapter should cover most editors.

**Round trip:** open the roll's raw scans in the editor (for NegPy, a folder of links to them, D51) → export into the inbox, keeping the raw's name → ingest as a Final with `parents` and `editor`, then stamp resolved catalogue metadata into the exported file. Matching falls back from filename to EXIF capture time to asking.

**NegPy specifics**

- Open source (GPL-3), Python + PyQt6. It never modifies source files and keeps edits in its own SQLite database keyed by a fingerprint of the file's content (its size and sampled bytes), so a copy or link of a raw keeps its edit.
- **No way in from outside:** no command line, URL scheme or other channel to open files. Its Library holds folder rolls and virtual rolls; "Import Subfolders as Rolls…" remembers a parent folder, and Refresh adds its new subfolders as rolls.
- **The NegPy folder (D51, D57):** `Editors/NegPy/` in the FilmFile folder, outside the archive, with a subfolder per roll (`2026-014 Nikon FE Portra 400 2026-03-14/`, named for NegPy's "Infer from Folder Name", with a hidden `.filmfile.json` naming the roll's ID) holding symbolic links to its raw scans, named `<roll>_Frame<frame>_<original name>`. NegPy reads through the links, writes exports and sidecars beside the link's path, and refuses to export over a source reached through a link. Originals are read-only, in case another program would write through a link.
- **Exports back (D53):** NegPy writes each export to a `.part` file and renames it, by default into `export/` beside the source, named `{{ original_name }}`. The service watches the NegPy folder and brings each export in as a Final of the frame its name starts with (`2026-014_Frame012A_`), with the raw scan it came from as its parent. NegPy's `{{ roll }}` and `{{ frame }}` read a `<roll>_Frame<n>` name too, but only the digits of a frame number.
- It writes per-frame **`.negpy` sidecars** (`<source name>.negpy`, beside the source) on export ("Save on Export") or via "Export Sidecars", and reads them when opening a roll only for frames with no database entry ("Load Edit from Sidecar…" forces it).
- **Recipes are stored twice:** the current sidecar next to the raw, and a hash-named snapshot in the export's version folder, so every export is reproducible.
- **Do not import NegPy code.** Reading its file formats is fine.

**darktable (later, FF-145–FF-147):** the same editor folder and names. darktable can be started on a roll's folder when it isn't already running, keeps edits in `<file>.<ext>.xmp` sidecars beside each image (captured as recipes), reads an XMP already there on import (so the service can write catalogue details into it first), and exports to `darktable_exported/` beside the source.

---

## 10. Storage, sync and backup (planned)

**S3 has three roles:** backup, sync between devices, and hosting the public gallery (in a separate bucket). Backup and sync cover the library (`Library/`) and `settings.json` only (D57, D65).

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

## 11. Workflows (planned; format deferred)

- **Events in the archive trigger workflows:** version added, frame tagged, rating changed, roll completed, and so on. A workflow is a trigger, a filter and a list of steps.
- **Local compute runs workflows**, initially on one designated device. Central coordination may come later.
- **Deterministic job keys:** frame ID + version hash + workflow name + workflow version. Completed jobs are skipped, so steps can be retried and backfilled over the whole archive.
- **Outcomes go in `.state.json`.** The job queue lives in SQLite and is operational only.
- **Built-in actions plus an escape hatch:** S3, export, resize, contact sheet and gallery publish; then run-a-script and webhook.

To decide later: the definition format for triggers, filters and steps.

---

## 12. Web gallery (planned; sites first)

- **Sites first (D91, D92):** a site is a name and a selection of frames kept in `Library/sites/`: a selection (D93) is a list of rules (rating, event, roll, camera, lens, film stock, date shot, has a Final or a Raw scan, each with the control that suits it, all ANDed) plus frames added or left off by hand, shared with exports. Building it makes a self-contained static site in `Sites/<site>/` (HTML, CSS, a small script and web-sized images; no GPS, no originals, metadata only author and copyright), always from the archive as it is, grouped by roll or event as chosen, and made again only where something changed (images are named by a hash of their inputs, and `site.json` says whether the site is up to date). Uploading it, to an S3 bucket or Cloudflare R2, is a separate step.
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
                               └─▶│ Application │──┤   │ Holding area            │ deleted/   │ (S3 prefix)
                                  │ (use cases) │  ├──▶│ Catalogue index (planned)│ SQLite    │ (SQLite/Postgres)
                                  └─────┬──────┘  │   │ Preview provider        │ sharp+cache│ (sharp+S3)
                                        │         └──▶│ Clock, Ids              │ node       │
                                  ┌─────▼──────┐      └─────────────────────────┘
                                  │   Domain    │
                                  └────────────┘
```

### 13.2 Layers and dependency rules

The layers are **folders within the service package**, with a lint rule (`eslint-plugin-boundaries`) run in CI that fails the build if an import points the wrong way.

| Layer | Contains | May import |
|---|---|---|
| `domain/` | Entities and value objects (Roll, Frame, Version, FrameNumber, Meta), frame-number rules, metadata resolution and provenance, invariants and domain errors. Pure: no I/O, no time, no randomness. | Nothing outside `domain/` |
| `application/` | Use cases, and the **port interfaces** they depend on (`application/ports/`). Orchestrates domain + ports. | `domain/` |
| `adapters/` | Inbound adapters (HTTP), which call the application, and outbound adapters (filesystem, sharp, Node clock and IDs, in-memory). A SQLite adapter is planned with the catalogue index. | `application/`, `domain/`, libraries |
| `composition/` | Composition roots that build the object graph for each runtime. | Everything |
| `main.ts` | Reads config, calls a composition root, starts the server. | `composition/` |

The web UI imports only `@filmfile/contracts` (the API schemas and generated client), never the service.

### 13.3 Three distinct models

Each boundary has its own representation, mapped explicitly at the adapter:

- **Domain model** (`domain/`): plain TypeScript types and functions that enforce invariants.
- **Persistence model** (filesystem adapter): the JSON file formats in section 5, defined as Zod schemas with `schema` versions and migrations. Validated on every read and write.
- **API model** (`@filmfile/contracts`): request and response DTOs as Zod schemas, which generate the OpenAPI spec.

In Phase 1 the persistence and domain shapes are deliberately close, so the mapping is thin. Keeping them separate means file formats and the API can evolve without touching the domain.

Version responses expose the original basename as `fileName`, never the file's relative or absolute path (D83).

### 13.4 Ports (Phase 1)

Outbound ports, defined in `application/ports/` and implemented by outbound adapters:

| Port | Responsibility | Local adapter | Cloud adapter (later) |
|---|---|---|---|
| `SettingsRepository` | Read and save `settings.json` at the FilmFile folder's top level (id and meta) | JSON file | S3 object |
| `RollRepository` | Get, list, create, change and save rolls; explicit single and batch renumber operations. Versioned writes reject a stale snapshot with `ConcurrencyConflict`; roll creation and renumbering enforce unique roll numbers | JSON files: archive-wide in-process lock, version check, temp file + rename; batch renumber with best-effort rollback (D77–D78) | S3 conditional writes (future) |
| `EquipmentRepository` | Cameras, lenses, films | JSON files | S3 objects |
| `BlobStore` | Write-once storage of image files: `put` accepts inspected bytes and returns the relative file path; `get` reads by that path. Never overwrites | Labeled frame and version folders in the archive | S3 (future) |
| `HoldingArea` | Receives deleted versions and frames (their files plus their JSON) and deleted rolls (the whole folder, frames and all), for me to empty by hand. Never deletes | `deleted/` in the archive | S3 prefix |
| `CatalogueIndex` (planned) | Read model for listing and filtering: upsert a resolved roll, remove, query, rebuild | Not implemented; current roll listings read through `RollRepository` | SQLite or Postgres (future) |
| `PreviewProvider` | Thumbnails and previews by content hash, generated lazily | sharp + cache folder | sharp + S3 cache |
| `ImageInspector` | Reads an uploaded image's pixel dimensions from its header, within the input pixel limit | sharp; a TIFF's or raw's (Sony ARW) size from its TIFF tables, by our own reader | same |
| `Clock`, `IdGenerator` | Current time; ULIDs | Node | Node |

The filesystem roll repository takes one in-process lock around every roll
read and mutation. This keeps versioned listings stable while a batch is
validated and applied, including frame and version metadata changes made
through the repository. It serializes unrelated roll operations; the local
single-user service favors a consistent snapshot. It does not coordinate
direct filesystem edits or another process (D77). A batch attempts to restore
the original roll files and folders when a filesystem operation fails, but
cannot recover automatically if the process stops mid-batch; an incomplete
rollback is surfaced as an error (D78).

The inbound adapter in Phase 1:

- **HTTP API**: Hono with `@hono/zod-openapi`. Parses requests with the contracts schemas, calls a use case, maps the result to a response.

There is **no catalogue index or domain event bus yet**. Use cases currently read and write through repositories directly. An index and event-bus port can be added with the features that need them, such as workflows.

### 13.5 Use cases

Each use case is a class with its dependencies injected through the constructor and a single `execute(ctx, input)` method:

- `ctx` is an **archive context** (`{ archiveId }`). There's only one archive today, but threading it through every use case means a future multi-archive or multi-user setup doesn't require rewiring.
- Use cases return a **`Result<T, E>`** (a small in-house discriminated union, no library) rather than throwing for expected failures. Current use cases return typed errors such as `NotFound`, `ValidationFailed`, `ConcurrencyConflict` and `AlreadyExists`, which the HTTP adapter maps to status codes (404, 422, 409 and 409). `MappingInvalid` remains in the error model for the deferred mapping design; there is no mapping use case today.
- Unexpected errors (I/O failure, bugs) throw and become a 500 with a logged correlation ID.

### 13.6 Dependency injection

**Pure DI**: constructor injection everywhere, no container library and no decorators.

- Each runtime has a **composition root**: a plain, typed function that builds adapters, injects them into use cases, and injects the use cases into the HTTP routes.
  - `composeLocal(config)`: filesystem repositories and blob store, Node clock and ULIDs, sharp image inspection and previews.
  - `composeInMemory(overrides?)`: in-memory storage adapters, a fixed clock and sequential IDs. Image inspection still uses sharp. Used by tests and a possible demo mode. `overrides` swaps individual adapters.
  - `composeCloud(config)`: later, with S3 and cloud adapters.
- Because wiring is ordinary TypeScript, a missing or mismatched dependency is a compile error, not a runtime surprise.
- Ports are interfaces; adapters are classes implementing them. Production object graphs are assembled in `composition/`; adapter tests may instantiate adapters directly.

### 13.7 Testing strategy

- **Domain:** pure unit tests (table-driven for frame-number rules and the metadata resolver).
- **Use cases:** tested through `composeInMemory`. This is where most behaviour is tested, and it's fast because nothing touches disk.
- **Port contract tests:** shared suites cover the implemented in-memory and filesystem adapters where both exist; S3 adapters are future work. They verify adapter behavior, including stale-version conflicts.
- **HTTP:** Hono `app.request` tests against an in-memory composition, checking status codes, ETags and validation errors.
- **End to end:** a small Playwright suite against `composeLocal` with a temp archive and generated fixture scans.

### 13.8 API

- **REST resources** with an **OpenAPI spec generated from the Zod schemas** in `@filmfile/contracts`, served at `/api/openapi.json` with an interactive docs page at `/api/docs` (useful for exploring and testing the API alongside the UI). The docs page's assets are served by the service itself, not a CDN, so the CSP needs no exceptions.
- The web UI uses a **typed client generated from the spec** (`openapi-typescript` + `openapi-fetch`), so it depends only on the API contract.
- A roll response includes its catalogue fields and `ETag`; resolved metadata with provenance is returned by the frame-details endpoint. Versioned writes require `If-Match` and return 409 on conflict.
- **Image data and metadata have separate endpoints.** Frames are created and edited as JSON (`/api/rolls/{rollId}/frames`). Images are uploaded as versions of a frame, one file per request, with the raw image as the body (`POST /api/rolls/{rollId}/frames/{frameId}/versions?file=…`); the query carries the original file name and kind. Uploads support the implemented Scan, Raw scan and Final kinds. Batch import and scan-list matching remain planned. A raw image body can't be sent by a cross-site form.
- Original files and thumbnails are read through their version (`…/versions/{versionId}/file` and `…/versions/{versionId}/thumbnail?size=small|large`), never by path or hash. Thumbnails are cached by content hash behind the scenes.

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
        outbound/filesystem/ repositories, blob store, persistence schemas
        outbound/sharp/      preview provider
        outbound/node/       clock, ULID generator
        outbound/memory/     in-memory implementations of storage ports used in tests
      composition/         composeLocal, composeInMemory
      main.ts
    test/
      contracts/           port contract suites
      fixtures/            generated fixture archives and lab scans
  web/                     @filmfile/web — React UI
  desktop/                 @filmfile/desktop — the Electron app: starts the service and opens a window on it (D54);
                           scripts/package.ts builds FilmFile.app and FilmFile.dmg (D56)
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
| Metadata (Phase 2) | `exiftool-vendored`; raw previews come from our own reader of TIFF tables (U20) |
| Index (planned) | SQLite via `better-sqlite3`, in the OS cache directory |
| IDs | ULID |
| Web UI | React + Vite + TanStack Query |
| Tests | Vitest, `fast-check`, Playwright |
| Quality | ESLint (`typescript-eslint` strict type-checked), `eslint-plugin-boundaries`, Prettier |
| S3 (Phase 4) | AWS SDK v3 |

### 13.11 Service behaviour

- Listens on `127.0.0.1` by default. Network or cloud access requires authentication, to be designed with the cloud adapters.
- Serves the built web UI at `/`, so the UI and API share one origin and the Origin check needs no exceptions. In development, Vite proxies `/api` to the service, and the service's allowed UI origin is set to the Vite dev server's through configuration.
- Runs inside the desktop app (D54): Electron's main process starts it in a `utilityProcess` on a free port and stops it on quitting, and only one copy of the app runs, so there's one writer. It can still be started on its own (`pnpm start`, with `FILMFILE_FOLDER` set) for development and a browser.
- Exporting several frames in the desktop app writes JPEGs straight into a folder the person chooses (D100): the service asks its parent app for it over the utility process's message channel, which the page can't reach, and writes only there, for that export, never replacing a file that's there. In a browser, or started on its own, it has no parent to ask and exports are downloaded as a zip.
- Editor integration, including launching an editor and reconciling its exports, is planned; see section 9.
- The UI only displays generated JPEG/WebP previews, since browsers can't show TIFF or raw.
- The desktop app's window is locked down (context isolation, sandbox, no Node.js in the page, no preload), sends links elsewhere to the default browser, and refuses permission requests. The FilmFile folder is chosen in the app's own dialogs and kept in its per-computer settings (D52); Settings shows where it is through a read-only `folder` field of `GET /api/settings`, the one absolute path the API returns (D64).
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

**Ideas backlog:** equipment register linked to repair notes, shot-log import from phone apps, central workflow coordination, running on a NAS, a Tauri desktop wrapper.

---

## 15. Open questions

- **Choosing locations on a map:** a map picker (and showing frames on a map) needs map tiles from an outside service, which means loosening the CSP and calling out to the network. Until then locations are typed or pasted as coordinates (D26).
- **Name clearance:** check the domain, GitHub organisation and UK IPO register for FilmFile, noting the Print File brand.
- **Masters in Standard-IA too?** Whether hi-res files should be fetchable from other devices.
- **Workflow definition format.**
- **Other devices:** viewing only, or editing too?

---

## 16. Glossary

- **Roll number:** the roll's unique, freeform label, often `YYYY-NNN` (e.g. `2026-014`). New-roll suggestions and “Re-number rolls…” use the archive-wide pattern in Settings. It can be changed by a rename; the roll's ULID (`RollId` in code) never changes.
- **Frame number:** the number printed on the film rebate beside each frame (e.g. `23`, `12A`); a frame's identity.
- **Lab batch:** the lab's order number, the `BBBB` in `BBBBNNNN.jpg`.
- **Scan index:** the lab's or camera's sequence number for a scan; not the frame number.
- **Master:** a hi-res file exported from the editor.
- **Recipe / sidecar:** the editor's edit settings stored as a file next to the raw.
- **Preview:** a low-res rendition of a version (thumbnail or screen size), generated from the version's file and cached outside the archive. Not a version.
