# FilmFile roadmap

The work still to do, grouped by feature in the order it'll be done, then what's for later, the decisions made along the way, and what's been built. This is an index: each task has its own file in `docs/tasks/`, with why it's wanted, what it is, its acceptance criteria, what's not in it, and notes. `docs/design.md` says what FilmFile is and how it's built; `docs/plan-phase-0-1.md` was the first plan and holds the formats, fields and routes in detail.

Each task is about one commit: small enough to review in one sitting, with its tests in the same commit, starting from the outside (an API test for an endpoint, a page test or journey for something in the browser). `pnpm verify` passes at the end of every task, and every acceptance criterion is ticked in its file. Tasks in a group have their acceptance criteria written before they're built, and reviewed then; tasks in Later have theirs written when they're planned into a group. Every task to do has an FF-number, three digits from 100 (`FF-100`), the next free one when it's planned, whatever part of FilmFile it's in. Done tasks keep the codes they were built under (U82, N3, S1.5, 1.3.2), which commit messages cite; open tasks planned under one of those say so in their file ("Was: U22a").

`[x]` done, `[ ]` to do, `[-]` dropped or replaced (with where it went).

**Next up:** 1. Multi-version frames, finished off.

---

## To do

### 1. Multi-version frames, finished off

What a frame has is seen at a glance on its thumbnail, a roll's frames are grouped by event, the version shown is chosen with a star, and frames can be marked to scan. The group's finished tasks are under Done.

- [ ] [FF-100 Stars on thumbnails](tasks/FF-100.md): a frame's rating as small stars wherever its thumbnail is.
- [ ] [FF-101 One event per frame](tasks/FF-101.md): a frame's own event is one event, not a list (D50).
- [ ] [FF-102 A roll's frames grouped by event](tasks/FF-102.md): a roll whose frames are in more than one event shows them under a heading for each.
- [ ] [FF-103 Choose the version shown](tasks/FF-103.md): a star on each version in the frame view chooses the one shown everywhere.
- [ ] [FF-104 Mark frames to scan](tasks/FF-104.md): mark frames to be scanned at higher resolution.

### 2. The FilmFile folder

Everything FilmFile keeps in one folder chosen once: the library (the archive) and, beside it, what's made from it (D57).

- [ ] [FF-105 The FilmFile folder](tasks/FF-105.md): one folder holding Library, Exports, Sites and Editors, chosen in place of the archive.

### 3. Roll numbers

Roll numbers can be put in date order after importing a batch of rolls, then locked once the physical sleeve is labelled, so they never change again (D59).

- [ ] [FF-106 Change a roll's number](tasks/FF-106.md): "Change roll number…" on a roll, moving its folder and keeping its ID.
- [ ] [FF-107 Lock a roll's number](tasks/FF-107.md): once the sleeve is labelled, a roll's number can't change.
- [ ] [FF-108 Number rolls by date](tasks/FF-108.md): put a year's unlocked rolls in date order with a preview first.

### 4. Finding your way around the library

The library keeps IDs in its folder names, so nothing moves when frames are renumbered (D17); it's made easy to find your way around another way (D58).

- [ ] [FF-109 Originals read-only](tasks/FF-109.md): the service makes originals read-only, so nothing reaching them through a link can change them.
- [ ] [FF-110 A contents file in each roll's folder](tasks/FF-110.md): `contents.txt` in each roll's folder says which frame each folder is.
- [ ] [FF-111 The browse folder](tasks/FF-111.md): `Browse/` in the FilmFile folder: links to every roll's files, named by frame number.

### 5. Integrate with NegPy

The round trip of design section 9: a roll's raw scans go where NegPy can find them, and NegPy's exports come back as Finals by themselves. NegPy can't be told to open files from outside (no command line, URL scheme or other way in), so FilmFile keeps a folder of rolls, `Editors/NegPy/` in the FilmFile folder (FF-105), which NegPy imports once with "Import Subfolders as Rolls…" and picks new rolls up from with Refresh (D51).

- [ ] [FF-112 Open a roll in NegPy](tasks/FF-112.md): "Open in NegPy" puts links to a roll's raw scans in `Editors/NegPy/`.
- [ ] [FF-113 Bring in NegPy's exports](tasks/FF-113.md): NegPy's exports in a roll's folder become Finals of their frames.
- [ ] [FF-114 Exports brought in by themselves](tasks/FF-114.md): the service watches the NegPy folder and brings exports in as they appear.
- [ ] [FF-115 NegPy's recipes kept](tasks/FF-115.md): NegPy's `.negpy` edit is kept with each Final it made.

### 6. Exports

Frames marked for export are kept in `Exports/` as JPEGs carrying everything known about them, made from the version shown and kept in step as frames change (D60).

- [ ] [FF-116 Mark frames for export](tasks/FF-116.md): mark the frames to keep as exports, one at a time or in bulk.
- [ ] [FF-117 The export folder](tasks/FF-117.md): `Exports/` holds a JPEG of every frame marked for export, kept in step.
- [ ] [FF-118 What an export says about itself](tasks/FF-118.md): exports carry the frame's details as EXIF, IPTC and XMP.

### 7. Event sites

An event's best frames as a small static website, made into `Sites/` and published to S3 when wanted (design section 12, D61).

- [ ] [FF-119 Choose an event's frames for its site](tasks/FF-119.md): which frames an event's site shows: by rating, with exceptions.
- [ ] [FF-120 Make an event's site](tasks/FF-120.md): a static site of an event's chosen frames, made in `Sites/`.
- [ ] [FF-121 Publish a site to S3](tasks/FF-121.md): upload an event's site to an S3 bucket, and take it down again.

### 8. Index and maintenance

- [ ] [FF-122 `CatalogueIndex`](tasks/FF-122.md): rolls, frames and equipment indexed in SQLite in the cache.
- [ ] [FF-123 `RebuildIndex`](tasks/FF-123.md): rebuild the index from the archive.
- [ ] [FF-124 `ListRolls` through the index](tasks/FF-124.md): the rolls list filtered and sorted through the index.
- [ ] [FF-125 `CheckIntegrity`](tasks/FF-125.md): check every file the archive lists is there and right.
- [ ] [FF-126 Maintenance routes](tasks/FF-126.md): API routes for the integrity check and index rebuild.
- [ ] [FF-127 Maintenance page](tasks/FF-127.md): run the integrity check and rebuild the index from the browser.
- [ ] [FF-128 Conflict handling](tasks/FF-128.md): on a 409, re-apply a change that doesn't clash.

---

## Key journeys

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
| Describe a roll (U7 onwards) | Create a roll with its name, notes, date, scans, camera, film stock and lens, then find it grouped and filtered by each |
| Organise by event (U12a–U12c, FF-130) | Create an event, put rolls in it, and browse to them by event; give it a date on the Events page; open it to see its frames from every roll, grouped by roll; later, an event inside another, whose frames show under its parent too |
| First run (1b.2) | On an archive never set up, any page asks for setup first; give the author and see the copyright made from it, land on the page asked for, then change the copyright, be taken back to the rolls, and find it in Settings after a reload. Runs against a server of its own, since it needs an empty archive |
| Bulk edit (U16, U17) | Select a run of a roll's frames, give them another camera and put them in an event, then find them marked as having their own, with the camera in their details, the roll's other frames left as they were, and just those frames on the event's page |
| Desktop app (U82–U84) | The app opens FilmFile in its own window on the Rolls page, its page can't use Node.js or open windows, quitting stops the service, and a second copy doesn't start; on first launch it asks for the archive, refuses a folder of other files and remembers the choice; Open Archive… switches; an archive gone missing is asked for again. Launches the app itself, on folders of its own, answering its dialogs; and, once built, the packaged app serves the UI and makes thumbnails |

---

## Later

Tasks for later, in no particular order: some set aside on purpose, some not yet given a place. They keep their IDs, so references to them still hold; when one is picked up, it moves into the feature group it'll be done in.

- [ ] [FF-129 Equipment page](tasks/FF-129.md): cameras, lenses and film stocks, with how many rolls use each.
- [ ] [FF-130 Sub-events](tasks/FF-130.md): an event inside another.
- [ ] [FF-131 Raws in batches](tasks/FF-131.md): a scan list from the frames marked to scan, and raws matched to it.
- [ ] [FF-132 Tag frames](tasks/FF-132.md): tags on frames.
- [ ] [FF-133 Locations](tasks/FF-133.md): places on events, rolls and frames.
- [ ] [FF-134 Add raw scans or finals to a roll's frames together](tasks/FF-134.md): raw scans or finals for many frames at once, matched by name.
- [ ] [FF-135 The newest Final shown](tasks/FF-135.md): a frame's newest Final shown in place of its first version.
- [ ] [FF-136 Exports that didn't match](tasks/FF-136.md): choosing frames for NegPy exports that didn't match one.
- [ ] [FF-137 A signed and notarised Mac app](tasks/FF-137.md): signed with a Developer ID and notarised.
- [ ] [FF-138 Updates](tasks/FF-138.md): the app updates itself.
- [ ] [FF-139 Windows and Linux](tasks/FF-139.md): the app for Windows and Linux.
- [ ] [FF-140 No open port](tasks/FF-140.md): a private protocol instead of a port on 127.0.0.1.
- [ ] [FF-141 The kind of scans a roll starts with](tasks/FF-141.md): choosing what kind the scans a roll starts with are.
- [ ] [FF-142 Roll creation in full](tasks/FF-142.md): a roll number suggested on New roll.
- [ ] [FF-143 Robust upload](tasks/FF-143.md): uploads that skip bad files, retry and resume.
- [ ] [FF-144 Export recipes](tasks/FF-144.md): export sizes, formats and what's left out.

### Integrate with darktable

For later, after "Integrate with NegPy", whose folder of links (in `Editors/`, FF-105), file names and way back it reuses. darktable can be started on a folder (`darktable <folder>` opens it in the lighttable), but not while it's already running (its library is locked); it keeps edits in XMP sidecars beside each image (`DSC04412.ARW.xmp`), reads one already there when it imports a file, and exports by default to `darktable_exported/` beside the source, under the source's name. To check first: whether it writes sidecars beside a link or beside the file the link points to (if the latter, copies instead of links), and whether it writes exports in one go or a bit at a time.

- [ ] [FF-145 Open a roll in darktable](tasks/FF-145.md): start darktable on a roll's folder.
- [ ] [FF-146 Catalogue details for darktable](tasks/FF-146.md): catalogue details written as XMP before darktable sees a raw.
- [ ] [FF-147 darktable's exports and recipes](tasks/FF-147.md): darktable's exports and sidecars brought in.

---

## Decisions

Made as the work goes, from 2 November 2026, and recorded in `docs/design.md` where they change the design. Tasks refer to them by number. The "Affects" column uses the original task IDs; tasks that moved into the slice or hardening say where they went.

| # | Decision | Affects |
| --- | --- | --- |
| D1 | The service serves the built UI at `/`, so UI and API share one origin. In development, Vite proxies `/api` to the service, and the allowed UI origin is set to the Vite dev server's through configuration. | 0.6.2, 1b.1 |
| D2 | The API docs page's assets are served by the service itself, not a CDN, so the CSP needs no exceptions. | 0.2.6 |
| D3 | ~~Mapping warnings~~: superseded by D19, which has no numbering warnings. | — |
| D4 | Lab scan uploads are limited to 200 MB per file, checked while streaming. | 1.3.6, 1.4.4 |
| D5 | *Superseded by D11:* there are no import sessions or staging. | |
| D6 | ~~Unconfirmed numbering badge~~: dropped. Rolls have no "numbering confirmed" state (D20). | — |
| D7 | Roll numbers are `YYYY-NNN` (e.g. `2026-014`), stored under `rolls/YYYY/YYYY-NNN/`. `YYYY` is the year shot; `NNN` is the next free number in that year when catalogued. No other formats. | 1.1.1, 1.2.1 |
| D8 | The API never invents a roll number; `CreateRoll` requires one. The UI suggests the next free number for a year, worked out from the roll list, but the field starts empty. | 1.3.3, FF-142 |
| D9 | Roll lists sort by roll number by default, or by shot date when chosen. Roll shot dates are optional. | FF-122, FF-124, 1b.6 |
| D10 | A roll number can be changed only by an explicit rename, which moves the roll's folder. The ULID is unchanged. | 0.4.1, 1.3.15, 1c.2 |
| D11 | The API has no import workflow. A roll is created first, then each frame is created and its lab scan uploaded as a version (D13); the UI drives the import. Frame numbers are optional on creation and can be set later. Creating a frame is an append that doesn't need `If-Match`; a scan whose hash is already in the roll returns 409, so retries are safe. Frames can be added to a roll that already has frames. | 1.3.6, 1.4.4, FF-142–1b.5 |
| D12 | Frames and rolls can be deleted as explicit, confirmed actions (any roll, not only an empty one: D38). Nothing is permanently deleted: deleted items move into `deleted/` in the archive, one dated folder each with the files and their JSON, and only the user empties it. No restore in the UI in Phase 1. | 0.4.1, 1.2.3, 1.3.16, 1c.2, U38 |
| D13 | Image data and metadata have separate endpoints. Frames are JSON; images are uploaded as versions of a frame (`POST …/frames/{frameId}/versions?file=…`, raw body). Versions have ULIDs and no `kind`; `defaultVersion` and `parents` refer to version IDs, never paths. Phase 1 uploads lab scans only. A frame with no versions is valid. `defaultVersion` is optional; when unset the newest version is shown. A single version can be deleted into the holding area. Originals are read by version ID. | 1.1.1, FF-125, 1.3.6, 1.3.11, 1.3.16, 1.4.3, 1.4.4, FF-143, 1b.7, 1b.8 |
| D14 | No "preview" versions: on-screen images are generated previews of the frame's shown version, cached outside the archive. Every version records `width` and `height`, read by the `ImageInspector` port at upload. | 1.1.1, 1.2.7, 1.3.6 |
| D15 | A frame's `defaultVersion` (optional version ID) is the version the UI shows; when unset, ~~the newest~~ its first version is shown (D46). It lives on the frame rather than as a flag on versions, so there can only be one. Set from the frame view. | 1.1.1, FF-125, 1b.8 |
| D16 | ~~Versions have no `kind`~~ (replaced by D48): a version is a version, and `defaultVersion` decides what's shown. How Phase 2 tells raws, masters and lab scans apart where behaviour differs is an open question; a `source` attribute recording where a file came from may be added then. | 1.1.1, S1.5 |
| D17 | Files are stored by version, not by kind: `frames/<frame>/<version>/<original name>`, each folder named by the last 8 characters of the ULID and unique within its parent. Same-named files never clash, sidecars sit beside their file, and deletes move one folder. NegPy can build a virtual roll from frames anywhere, so it doesn't need a `raw/` folder. | S1.5, 1.2 |
| D18 | A `roll.json` that can't be read (invalid JSON, not matching the schema, or from a newer FilmFile) doesn't fail the roll list: it's listed under `unreadable` with the problem, and shown in the UI. It's never changed or deleted, and a new roll can't be created over it. | H.8 |
| D19 | Frame numbering is driven from the UI. A frame number is free text of up to 9 characters, sorted naturally (leading number, negatives first, then text). Upload keeps numbering new frames in file-name order. Renumbering is a first number and a direction (plain integers, below zero if need be), worked out in the UI with a preview; the API stores only the numbers, in one save guarded by the roll's version. No anchors, overrides, skips or warnings; `00` is typed by hand. | N1–N8 |
| D20 | No "numbering confirmed" state, badge or button: a roll's numbers are simply what they are, corrected by editing or renumbering. | N7, N8 (dropped) |
| D21 | The interface follows design A ("light table") from the options canvas. Its fonts (Inter, IBM Plex Mono) are served by the backend from installed packages, not Google Fonts, so the CSP stays `default-src 'self'`. | U2 |
| D22 | Browser tests cover key journeys only, written against what a person sees and does (roles, labels, text), never CSS classes, test IDs, URLs or API calls, so refactoring the internals doesn't change them. Shared steps live in journey helpers. | U1 onwards |
| D23 | The rolls page's view (grid or list), grouping and filter are kept in the page's address, the view in every history entry so back and forward restore it. The grid or list choice, and whether the browse panel is open, are also remembered in the browser for fresh visits. | U4, U6 |
| D24 | A roll belongs to at most one event, which may be nested in another. Frames can be in events too (D25). Events come in stages: flat events (U12a), the Events page to create and edit them with dates (U12b), an event's own page of frames (U12c), then, later, sub-events (FF-130). | U12a–U12c, FF-130 |
| D25 | Frames inherit their roll's camera, film stock, lens and events and can have their own, set in bulk on selected frames. A roll has at most one event; ~~a frame can be in several~~ a frame in at most one of its own (D50). Grouping and filtering rolls use the roll's own values; an event's page shows frames from every roll. | U14–U17 |
| D26 | Locations are a place name with optional latitude and longitude, settable on events, rolls and frames, and inherited like the other details (design section 6). Coordinates are entered as text for now: a map picker would need map tiles from outside, which the CSP blocks (D21). | FF-133 |
| D27 | A roll has an optional name and description, and an optional date shot of varying precision: a year at least, then month, day and time (`2026`, `2026-09`, `2026-09-14`, `2026-09-14T15:30`, local time). The new roll page requires at least the year, starting it from the roll number, and marks required fields with an orange *. Rolls are created on their own page with their details and scans, not from a field on the rolls page. | U7 |
| D28 | A camera has a make and model (e.g. Nikon, FE), shown together ("Nikon FE"), its slug made from them (`nikon-fe`); format and notes wait until the UI uses them. Cameras, film stocks and lenses are each chosen from a dropdown whose last option, Add new…, asks for the new one's details. A camera file from before makes and models were kept apart (schema 1, one name) is read with its first word as the make. | U9a, U11a |
| D29 | A film stock has a make and name (e.g. Kodak, Portra) and optionally an ISO, a type (black and white, colour negative or colour slide) and a format (35mm, 120, 220, 127, 110, 4×5, 8×10). It's shown as make, name and ISO, e.g. "Kodak Portra 400", and its slug is made from that (`kodak-portra-400`), so stocks differing only in speed are told apart. No development process. It's chosen from a dropdown, not typed: its last option, Add new…, asks for a new film stock's make and name (required), ISO, type and format. | U10a |
| D30 | A lens has a make and name (e.g. Nikon, Nikkor AI-S) and optionally a focal length in millimetres and a widest aperture as an f-number. It's shown as "Nikon Nikkor AI-S 50mm f/1.8", and its slug is made from that (`nikon-nikkor-ai-s-50mm-f-1-8`). Mount, zooms and notes wait until the UI uses them. | U11b |
| D31 | An event is a name and the slug made from it (`events/iceland-2026.json`), and a roll names its event in a top-level `event` field of roll.json; its date arrives with U12b, the parent with sub-events (FF-130), and notes and location when the UI uses them. The API's events are at `/api/events`. | U12a |
| D32 | Events are created and edited on the Events page (New event, and editing each event's name, date and, later, parent). The roll forms' Add new… stays as a shortcut that creates an event from its name alone; its date is added on the Events page. An event has one optional date, a year with optional month and day, and no end date: nothing needs one yet. Events are listed newest first by date. Renaming an event keeps its slug. | U12b |
| D33 | An event is viewed as its frames, not its rolls: its page is one contact sheet of every frame from its rolls, which can be grouped by roll, camera, lens or film stock. Choosing an event anywhere, on the Events page or in the browse panel, opens that page; the rolls page no longer filters by event, though it can still group by event. | U12c |
| D34 | Camera raw scans are Sony ARW and Fujifilm RAF files, added to one chosen frame at a time as further versions; matching batches of raws to a scan list waits (FF-131, later). ~~Versions gain an optional `source` (lab scan, camera scan)~~ (a kind instead, D48), settling the design's open question on telling versions apart; raws are never written to, and their thumbnails come from their embedded preview. | U20, U21 |
| D35 | No labs are stored: `archive.json` holds the archive's name and archive-wide defaults (author, copyright, licence) only. Lab scans are recognised by their file name's shape as now and kept under their own names; scan direction is fixed by renumbering, not configured. | 1.3.1, 1b.2, FF-143 |
| D36 | No real-time notifications for now: the browser sees changes made elsewhere when it next loads the data, and a save refused because something changed says so (as now). The `Notifier` port, its server-sent events route and the browser's live updates are out of the plan. | 1.2.6, 1.4.7, 1b.1 |
| D37 | No file watcher until one is needed: files changed outside FilmFile (by hand or by sync) are validated whenever they're read, as `roll.json` already is, and the index is brought up to date by rebuilding it. | 1.3.14, 1.5.1 |
| D38 | Any roll can be deleted, not only an empty one, after a confirmation that says how many frames go with it: its whole folder moves into `deleted/`, as frames do. Replaces D12's rule that only empty rolls can be deleted. | U24 |
| D39 | A frame's rating is one to five stars, or none; there's no zero-star rating, and 0 (the key) clears it. | U29 |
| D40 | A roll has notes, not a description, as a frame does; neither inherits from the other. Notes are about the record they're on (how a roll was developed, what a frame shows), so they sit outside the inherited `meta` fields. | U32 |
| D41 | Rotating a frame turns the version shown, by quarter turns kept in the version's `transform.rotate`, as the design's non-destructive crop and rotate; the image file is never changed, and thumbnails are made turned. | U33 |
| D42 | No licence for now: the archive holds a name, author and copyright only. A licence (and how it's chosen) is decided when exports need one. | 1.3.1, 1b.2 |
| D43 | First-run setup is required: until `archive.json` exists, every page shows the setup form, since what's set there (author, copyright) is what frames will inherit. | 1b.2 |
| D44 | The archive has no name, only an author (required) and a copyright, since there's one archive and its name was never shown. An `archive.json` written with a `name` is read without it. The copyright is made from the author until it's written by hand. | 1b.2 |
| D45 | Film stock is the roll's alone: a roll is one film, so a frame can't have a film stock of its own, unlike its camera, lens and events (U15). | U52 |
| D46 | A frame shows its first version, its lab scan, unless one is chosen to show: a later camera raw or edit doesn't take its place by being added. Choosing which version is shown waits (FF-103). Replaces D15's newest. | U60, U61, U34, U28b |
| D47 | A frame can have its own date and time shot, in place of its roll's, like its camera, lens and events: a roll can be shot over several days. It's resolved and shown with the other details. | U59 |
| D48 | A version is a kind: Scan (ready to view, at any resolution), Raw scan (the negative or slide as scanned, before processing) or Final (processed), chosen as it's added and changeable later. Resolution isn't a kind: it's measured from the image and shown. Replaces D34's `source` and settles D16's open question. | U64, U20, FF-141, FF-112, FF-134, FF-135 |
| D49 | A thumbnail has one icon for whatever a frame has of its own, details or notes, rather than one for each, to keep small thumbnails uncluttered; its name says which. | U69, FF-100 |
| D50 | A frame is in at most one event of its own, as a roll is, replacing D25's several: the browser only ever gave one, and a day inside a trip is a sub-event (FF-130), whose frames are in its parent too. Each frame then sits under one heading when a roll is grouped by event. | FF-101, FF-102, FF-130 |
| D51 | A roll is opened in NegPy through a folder of symbolic links outside the archive, one subfolder per roll, imported once in NegPy as a parent of rolls and refreshed there. NegPy has no command line or other way in; it reads through links, writes exports and `.negpy` files beside the link (keeping the path it was given), and refuses to export over a source it reaches through a link. Outside the archive, because NegPy writes beside its files and can move them to the Trash; originals are made read-only as a guard. Links over clones because the archive may be on another drive. Settles FF-112's zip-or-folder question. | FF-112, U73, FF-109, FF-113 |
| D52 | Settings that belong to a computer, not the archive, such as the FilmFile folder (D57), are kept in a settings file in the OS config directory: a path on one computer means nothing on another, and the archive is synced. | U73 |
| D53 | The NegPy folder is watched, as bringing exports in by themselves needs it; D37 stands for the archive, whose files are still validated when read. | FF-114 |
| D54 | FilmFile becomes a desktop app with Electron, whose main process runs the service, unchanged, in a `utilityProcess` on a free port of `127.0.0.1` and opens a window on it. The service keeps its Host and Origin checks, a browser can still use it, and a crash or a long sharp job in the service doesn't freeze the window. The service runs while the app is open, not in the background (design 13.11). A private protocol with no port is for later (FF-140). | U82, U83, U84, FF-140 |
| D55 | ~~The app is packaged with Electron Forge, Electron's own tool, which puts its first-party packages (packager, rebuild, fuses, signing, notarising) together, rather than electron-builder.~~ Replaced by D56. | U84, FF-137 |
| D56 | The app is packaged by a script of our own with `@electron/packager` and `@electron/fuses`, the first-party packages Forge is made of, rather than Forge itself: Forge needs pnpm's flat, hoisted `node_modules`, and its disk image maker brings native install scripts. The service is bundled with rolldown (already installed with Vite) because Node won't strip types from TypeScript inside `node_modules`, where the contracts package would be; the disk image is made with macOS's own `hdiutil`. Replaces D55. | U84, FF-137 |

**Still open:** see `docs/design.md`, section 15.
| D57 | Everything FilmFile keeps is in one FilmFile folder, chosen once per computer: `Library/` (the archive, the only part backed up and synced), `Exports/`, `Sites/`, `Editors/` and `Browse/`, which are made from the library and can be made again. Caches stay in the OS cache folder. Replaces U73's separate NegPy folder setting. | FF-105, FF-111, FF-117, FF-120, FF-112 |
| D58 | Folder names in the library stay IDs (D17), so renumbering never moves an original: renames would make backup and sync upload raws again (and pay Glacier's 180-day minimum twice) and break links. The library is made easy to find your way around instead, with a `contents.txt` in each roll's folder and a `Browse/` folder of links named by frame number. | FF-110, FF-111 |
| D59 | A roll's number can be locked once its sleeve is labelled, and is then never changed. Before that, a year's unlocked rolls can be renumbered to follow their shot dates, after the year's locked rolls, with a preview first. | FF-106, FF-107, FF-108 |
| D60 | Exports are made files, kept in step by the service in `Exports/`: one JPEG per frame marked for export, from the version shown, carrying the frame's details as EXIF and XMP written by sharp. They're never originals, so remaking or removing one is safe; raws are never written to. | FF-116, FF-117, FF-118, FF-144 |
| D61 | An event's site is static HTML, CSS and web-sized images made into `Sites/`, showing the event's frames rated at least a chosen number of stars, with frames added or left off by hand. No GPS, no originals, and no metadata but author and copyright. Publishing uploads it to an S3 bucket with an AWS profile from `~/.aws`; FilmFile keeps no keys. | FF-119, FF-120, FF-121 |

---

## Done

What's been built, by the stage it was built in, oldest first.

### Foundations

- [x] [0.1.1–0.1.6 Repository and tooling](tasks/0.1.1-0.1.6.md)
- [x] [0.2.1 `Result`](tasks/0.2.1.md)
- [x] [0.2.2 Domain errors](tasks/0.2.2.md)

### S1: API slice — rolls and scans

Every task starts with API tests in `apps/backend/test/api/`, run against a temp archive.

- [x] [S1.1 Server runs](tasks/S1.1.md)
- [x] [S1.2 Create a roll](tasks/S1.2.md)
- [x] [S1.3 List and get rolls](tasks/S1.3.md)
- [x] [S1.3a Basic Zod parsing](tasks/S1.3a.md)
- [x] [S1.4 Create a frame](tasks/S1.4.md)
- [x] [S1.5 Upload a lab scan](tasks/S1.5.md)
- [x] [S1.6 Thumbnails and originals](tasks/S1.6.md)
- [x] [S1.7 Checkpoint](tasks/S1.7.md)

**Done when:** API tests pass for every endpoint, and S1.7 works with real scans.

### S2: Contracts and a basic UI

- [x] [S2.1 Contracts and OpenAPI](tasks/S2.1.md)
- [x] [S2.2 Typed client](tasks/S2.2.md)
- [x] [S2.3 Web app shell](tasks/S2.3.md)
- [x] [S2.4 Rolls page](tasks/S2.4.md)
- [x] [S2.5 Roll page](tasks/S2.5.md)
- [x] [S2.6 Checkpoint](tasks/S2.6.md)

**Done when:** S2.6 works with a real roll.

### H: Hardening the slice

Brings S1 and S2 up to the standards in `CLAUDE.md`. Security comes first.

- [x] [H.1 Host and Origin checks](tasks/H.1.md)
- [x] [H.2 Content type and security headers](tasks/H.2.md)
- [x] [H.3 Error handler](tasks/H.3.md)
- [x] [H.4 Safe paths and upload checks](tasks/H.4.md)
- [x] [H.5 IDs, clock and ID generator](tasks/H.5.md)
- [x] [H.6 Roll use cases and repository](tasks/H.6.md)
- [x] [H.7 Frame and version use cases](tasks/H.7.md)
- [x] [H.8 Persistence schemas and stable serialisation](tasks/H.8.md)
- [x] [H.9 Atomic writes and version tokens](tasks/H.9.md)
- [x] [H.10 In-memory adapters and contract suites](tasks/H.10.md)
- [x] [H.11 Test data and fixtures](tasks/H.11.md)
- [x] [H.12 Full CI and dependency updates](tasks/H.12.md)
- [x] [H.13 One fake service for the web tests](tasks/H.13.md)

**Done when:** the security API tests pass (wrong `Host`, foreign `Origin`, missing content type, traversal, oversized and disguised uploads), the slice runs through use cases and ports with contract suites for every port, and the full CI pipeline is green.

### N: Frame numbering

Driven from the UI (D19). Each task is a change you can see in the browser, with its tests at every level it touches.

- [x] [N1 Frame order](tasks/N1.md)
- [x] [N2 Number labels](tasks/N2.md)
- [x] [N3 Edit one number](tasks/N3.md)
- [x] [N4 Changed elsewhere](tasks/N4.md)
- [x] [N5 Renumber preview](tasks/N5.md)
- [x] [N6 Save a renumber](tasks/N6.md)
- [-] [N7 Confirm numbering** and **N8 Changing confirmed numbering](tasks/N7.md)

**Done when:** a real roll scanned tail to head can be renumbered and a frame's number corrected, all in the browser.

### U: The Option A interface

The "light table" design chosen from the options canvas (https://claude.ai/artifact/BfhJttJe5NC679GGg97Ay1, row A): dark and photo first, a rolls page with a Grid | List switch, Group by, and a browse panel that can be closed, and a roll page with its details above the contact sheet. Built in two stages: first the design with the data that exists today, then one layer of data at a time (shot date, camera, film stock, lens, events), each layer arriving through every level it needs and showing up wherever the design puts it.

#### The design, with today's data

- [x] [U1 Journeys first](tasks/U1.md)
- [x] [U2 Light table look](tasks/U2.md)
- [x] [U3 Rolls grid](tasks/U3.md)
- [x] [U4 Rolls list and the switch](tasks/U4.md)
- [x] [U5 Roll page layout](tasks/U5.md)
- [x] [U6 Group by, browse panel and filters, with years](tasks/U6.md)

**Checkpoint:** the app looks like the chosen design and every existing journey passes unchanged.

#### Layers of data

Each layer is one vertical slice: the field in the domain, `roll.json` (an optional field with a default, so older files still read), the API and contracts, the new roll page and "Edit details", and wherever the design shows it: the roll page's details row, cards, list columns, the browse panel, Group by and filters. Each extends the "Describe a roll" journey.

- [x] [U7 New roll page](tasks/U7.md)
- [x] [U8 Edit details](tasks/U8.md)
- [x] [U9a Record a roll's camera](tasks/U9a.md)
- [x] [U9b Find rolls by camera](tasks/U9b.md)
- [x] [U10a Record a roll's film stock](tasks/U10a.md)
- [x] [U10b Find rolls by film stock](tasks/U10b.md)
- [x] [U11a Camera dropdown, make and model](tasks/U11a.md)
- [x] [U11b Lens](tasks/U11b.md)
- [x] [U12a Events](tasks/U12a.md)
- [x] [U12b Events page: create and edit](tasks/U12b.md)
- [x] [U12c An event's frames](tasks/U12c.md)

**Checkpoint:** a real roll can be catalogued in the browser with its name, description, date shot, camera, film stock, lens and event, found again by grouping and filtering on each.

### Deleting

Deleting a frame or a roll into the archive's `deleted/` folder. Changing a roll's number (FF-106) is for later.

- [x] [U23 Delete a frame](tasks/U23.md)
- [x] [U24 Delete a roll](tasks/U24.md)

### Frame view and describing frames

- [x] [U26 Open a frame](tasks/U26.md)
- [x] [U27 A frame's details and versions](tasks/U27.md)
- [x] [U29 Describe a frame](tasks/U29.md)
- [x] [U32 A roll's notes](tasks/U32.md)
- [x] [U28a Delete a frame from the frame view](tasks/U28a.md)
- [x] [U33 Rotate a frame](tasks/U33.md)

### Archive settings

The archive's author and copyright, set on first run and changed later; no name (D44), no labs (D35), and no licence yet (D42).

- [x] [ArchiveRepository](tasks/ArchiveRepository.md)
- [x] [1.3.1 Archive](tasks/1.3.1.md)
- [x] [1.4.2 Archive routes](tasks/1.4.2.md)
- [x] [1b.2 First-run setup](tasks/1b.2.md)

### Frames' own details and bulk editing

Selecting frames on a roll and giving them all an event, camera, film stock or lens at once. Frames inherit these from their roll and can have their own, as the design's metadata layering describes (section 6): a frame shot on a second camera, or the few frames of a roll that belong to a particular event (D25).

- [x] [U14 Select frames](tasks/U14.md)
- [x] [U35 Meta resolver](tasks/U35.md)
- [x] [U36 A frame's resolved details](tasks/U36.md)
- [x] [U15 Frames' own details](tasks/U15.md)
- [x] [U37 Many frames in one save](tasks/U37.md)
- [x] [U16 Assign to selected frames](tasks/U16.md)
- [x] [U17 Events across rolls](tasks/U17.md)
- [x] [U38 Delete selected frames](tasks/U38.md)
- [x] [U39 Frame editing](tasks/U39.md)

### Tidying the roll and events pages

The roll page had grown a row of buttons in its heading and another above its frames, with nine more while selecting. Its actions go into one Actions menu beside the roll number, and selecting frames takes that menu's place (option 1 of the roll page wireframes). Film stock stays the roll's alone.

- [x] [U52 Film stock is the roll's](tasks/U52.md)
- [x] [U53 Breadcrumbs at title size](tasks/U53.md)
- [x] [U54 No frame order switch](tasks/U54.md)
- [x] [U55 One Actions menu](tasks/U55.md)
- [x] [U56 One Set menu while selecting](tasks/U56.md)
- [x] [U63 Events laid out like rolls](tasks/U63.md)

### Reworking the frame view

The details panel shows what a frame inherits without fuss, marks only what the frame has of its own, and edits details in place (option 1 of the frame view wireframes).

- [x] [U57 Inherited details shown plainly](tasks/U57.md)
- [x] [U58 Details edited in place](tasks/U58.md)
- [x] [U59 A frame's own date shot](tasks/U59.md)

### Multi-version frames

More than one version of a frame: a low-res scan to preview every frame, a hi-res raw scan of the negative or slide, and a processed final (design section 8.2). Each version is a kind, chosen as it's added (D48). Versions are added to one frame at a time for now; adding many frames' raw scans or finals together is for later (FF-134).

- [x] [U60 The first version is shown](tasks/U60.md)
- [x] [U34 Add a version](tasks/U34.md)
- [x] [U61 Versions in a column](tasks/U61.md)
- [x] [U28b Delete a version](tasks/U28b.md)
- [x] [U64 Version kinds](tasks/U64.md)
- [x] [U20 Raw scans as versions](tasks/U20.md)
- [x] [U69 Own details or notes as an icon](tasks/U69.md)
- [x] [U70 Many versions as an icon](tasks/U70.md)

### Desktop app

FilmFile as a Mac app, opened from the Dock rather than by starting a service and opening a browser (D54). Electron runs the service as it is, in a separate process (`utilityProcess`) on a free port of `127.0.0.1`, and opens a window on it; the web UI and API don't change, and still work from a browser while the app is open. Electron 45's own Node.js (24) runs the service's TypeScript directly, as Node 26 does, so nothing is bundled to run it from source; the packaged app bundles it, and leaves sharp's native files outside its app archive, which they can't be loaded from. Signing, updates and other platforms are for later.

- [x] [U82 FilmFile opens in its own window](tasks/U82.md)
- [x] [U83 Choose the archive](tasks/U83.md)
- [x] [U84 A packaged Mac app](tasks/U84.md)

### Replaced or dropped

Tasks from the first plan that turned out differently:

- U73 The NegPy folder: *replaced by FF-105, whose `Editors/NegPy/` it is (D57).*
- U21 Add a raw to a frame: *replaced by U64 and U20, adding a raw scan to one frame with its "+"; dropping raws onto frames on the roll page and marking frames that have them are for later if wanted.*
- U49 Invariants *(was 1.1.7)*: *the checks saving doesn't already make are in FF-125 CheckIntegrity; ratings are checked when roll.json is read (D39).*
- U50 End-to-end test *(was 1c.7)*: *done as the key journeys, which run in CI: first-run setup, importing scans, renumbering, describing and deleting.*
- U51 Checkpoint *(was 1c.8)*: *dropped, as 1b.9 was: real rolls are catalogued as we go.*
- [-] [1.1.1 Domain types](tasks/1.1.1.md)
- 1.1.2 Frame numbers, 1.1.3 Mapping engine, 1.1.4 Mapping warnings and 1.1.5 Remap: *replaced by free-text frame numbers and renumbering in N1–N6 (D19).*
- 1.2.1 `BlobStore`, 1.2.2 file signature check, 1.2.5 `PreviewProvider` and 1.2.7 `ImageInspector`: *in H.4 and H.7.*
- 1.3.3 `CreateRoll` and `GetRoll`, 1.3.6 `CreateFrame` and `AddVersion`, 1.3.11 `GetThumbnail` and `GetOriginal`: *in H.6 and H.7.*
- [x] [1.3.2 Equipment](tasks/1.3.2.md)
- 1.3.9 Numbering: *replaced by N3 and N6; confirming numbering dropped (D20).*
- 1.4.5 Mapping routes: *dropped; the browser works numbers out (D19).*
- 1b.5 Numbering, 1b.6 Rolls grid and 1b.7 Roll view: *replaced by N1–N6, U3–U6 and U5.*
- [-] [1b.9 Checkpoint](tasks/1b.9.md)
- 1c.4 Fix numbering: *replaced by N3–N6.*
- 1.2.3 `HoldingArea`, 1.3.15 `RenameRoll`, 1.3.16 deleting versions, frames and rolls, and 1c.2 roll editing's rename and delete: *split into U23, U24 and FF-106, with deleting a version in the frame view (1b.8).*
- 1b.8 Frame view: *split into U26–U28b.*
- 1.4.3 Remaining roll and frame routes: *the delete and rename routes in U23, U24 and FF-106; bulk frame edits with U16; sort and filter parameters with the index (FF-124).*
- 1.2.6 `Notifier`, 1.4.7 server-sent events route and 1b.1 live updates: *dropped (D36).*
- 1.3.10 and 1.4.6, the sleeve photo: *dropped.*
- 1.3.14 `ReconcileExternalChange` and 1.5.1 the file watcher: *dropped until needed (D37).*
