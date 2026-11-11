# FilmFile roadmap

The work, grouped by feature in a fixed order, then the key journeys, the decisions made along the way, and what was replaced or dropped. In each group the tasks still to do come first, then the finished ones, the most recently finished first; a task finished moves down to just below the unfinished ones, and stays in its group. This is an index: each task has its own file in `docs/tasks/`, with why it's wanted, what it is, its acceptance criteria, what's not in it, and notes. `docs/design.md` says what FilmFile is and how it's built; `docs/plan-phase-0-1.md` was the first plan and holds the formats, fields and routes in detail.

Each task is about one commit: small enough to review in one sitting, with its tests in the same commit, starting from the outside (an API test for an endpoint, a page test or journey for something in the browser). `pnpm verify` passes at the end of every task, and every acceptance criterion is ticked in its file. Tasks in a group have their acceptance criteria written before they're built, and reviewed then; tasks tagged `[later]` have theirs written when they're planned to be done. Every task to do has an FF-number, three digits from 100 (`FF-100`), the next free one when it's planned, whatever part of FilmFile it's in. Done tasks keep the codes they were built under (U82, N3, S1.5, 1.3.2), which commit messages cite; open tasks planned under one of those say so in their file ("Was: U22a").

`[x]` done, `[ ]` to do (`[later]` marks one set aside or not yet planned), `[-]` dropped or replaced (with where it went).

**Next up:** 11. Integrate with NegPy.

---

## Features

### 1. Foundations and the API slice

The repository and tooling, the API for rolls and scans (every task starting with API tests in `apps/backend/test/api/`, run against a temp archive), the contracts and a basic UI over it, and the hardening that brought them up to the standards in `CLAUDE.md`, security first. Done when the security API tests pass (wrong `Host`, foreign `Origin`, missing content type, traversal, oversized and disguised uploads), the slice runs through use cases and ports with contract suites for every port, and the full CI pipeline is green.

- [x] [H.13 One fake service for the web tests](tasks/H.13.md)
- [x] [H.12 Full CI and dependency updates](tasks/H.12.md)
- [x] [H.11 Test data and fixtures](tasks/H.11.md)
- [x] [H.10 In-memory adapters and contract suites](tasks/H.10.md)
- [x] [H.9 Atomic writes and version tokens](tasks/H.9.md)
- [x] [H.8 Persistence schemas and stable serialisation](tasks/H.8.md)
- [x] [H.7 Frame and version use cases](tasks/H.7.md)
- [x] [H.6 Roll use cases and repository](tasks/H.6.md)
- [x] [H.5 IDs, clock and ID generator](tasks/H.5.md)
- [x] [H.4 Safe paths and upload checks](tasks/H.4.md)
- [x] [H.3 Error handler](tasks/H.3.md)
- [x] [H.2 Content type and security headers](tasks/H.2.md)
- [x] [H.1 Host and Origin checks](tasks/H.1.md)
- [x] [S2.6 Checkpoint](tasks/S2.6.md)
- [x] [S2.5 Roll page](tasks/S2.5.md)
- [x] [S2.4 Rolls page](tasks/S2.4.md)
- [x] [S2.3 Web app shell](tasks/S2.3.md)
- [x] [S2.2 Typed client](tasks/S2.2.md)
- [x] [S2.1 Contracts and OpenAPI](tasks/S2.1.md)
- [x] [S1.7 Checkpoint](tasks/S1.7.md)
- [x] [S1.6 Thumbnails and originals](tasks/S1.6.md)
- [x] [S1.5 Upload a lab scan](tasks/S1.5.md)
- [x] [S1.4 Create a frame](tasks/S1.4.md)
- [x] [S1.3a Basic Zod parsing](tasks/S1.3a.md)
- [x] [S1.3 List and get rolls](tasks/S1.3.md)
- [x] [S1.2 Create a roll](tasks/S1.2.md)
- [x] [S1.1 Server runs](tasks/S1.1.md)
- [x] [0.2.2 Domain errors](tasks/0.2.2.md)
- [x] [0.2.1 `Result`](tasks/0.2.1.md)
- [x] [0.1.1–0.1.6 Repository and tooling](tasks/0.1.1-0.1.6.md)

### 2. Frame numbering

Driven from the UI (D19): each task is a change you can see in the browser. Done when a real roll scanned tail to head can be renumbered and a frame's number corrected, all in the browser.

- [x] [N6 Save a renumber](tasks/N6.md)
- [x] [N5 Renumber preview](tasks/N5.md)
- [x] [N4 Changed elsewhere](tasks/N4.md)
- [x] [N3 Edit one number](tasks/N3.md)
- [x] [N2 Number labels](tasks/N2.md)
- [x] [N1 Frame order](tasks/N1.md)
- [x] [N7 Confirm numbering** and **N8 Changing confirmed numbering](tasks/N7.md)

### 3. Rolls and the roll page

The "light table" design chosen from the options canvas (https://claude.ai/artifact/BfhJttJe5NC679GGg97Ay1, row A): dark and photo first, a rolls page with a Grid | List switch, Group by, and a browse panel that can be closed, and a roll page with its details above the contact sheet; creating and editing a roll; deleting frames and rolls into the archive's `deleted/` folder; and tidying the roll page, whose actions go into one Actions menu beside the roll number, with selecting frames taking that menu's place.

- [x] [FF-172 Back to the rolls you were looking at](tasks/FF-172.md)
- [x] [FF-160 A tidier rolls page header](tasks/FF-160.md)
- [x] [U56 One Set menu while selecting](tasks/U56.md)
- [x] [U55 One Actions menu](tasks/U55.md)
- [x] [U54 No frame order switch](tasks/U54.md)
- [x] [U53 Breadcrumbs at title size](tasks/U53.md)
- [x] [U52 Film stock is the roll's](tasks/U52.md)
- [x] [U24 Delete a roll](tasks/U24.md)
- [x] [U23 Delete a frame](tasks/U23.md)
- [x] [U8 Edit details](tasks/U8.md)
- [x] [U7 New roll page](tasks/U7.md)
- [x] [U6 Group by, browse panel and filters, with years](tasks/U6.md)
- [x] [U5 Roll page layout](tasks/U5.md)
- [x] [U4 Rolls list and the switch](tasks/U4.md)
- [x] [U3 Rolls grid](tasks/U3.md)
- [x] [U2 Light table look](tasks/U2.md)
- [x] [U1 Journeys first](tasks/U1.md)

### 4. Metadata

What a roll is catalogued with, one layer of data at a time: camera, film stock, lens and event, each arriving through every level it needs and showing up wherever the design puts it (the roll page's details row, cards, list columns, the browse panel, Group by and filters). Film stock stays the roll's alone. Tags and places are for later.

- [ ] [later] [FF-130 Sub-events](tasks/FF-130.md): an event inside another.
- [ ] [later] [FF-132 Tag frames](tasks/FF-132.md): tags on frames.
- [ ] [later] [FF-133 Locations](tasks/FF-133.md): places on events, rolls and frames.
- [x] [FF-175 Link events and equipment to where they lead](tasks/FF-175.md)
- [x] [FF-173 Mark a frame as in no event](tasks/FF-173.md)
- [x] [FF-171 A date for a new event added from a roll](tasks/FF-171.md)
- [x] [FF-169 Edit an event from its page](tasks/FF-169.md)
- [x] [U63 Events laid out like rolls](tasks/U63.md)
- [x] [U12c An event's frames](tasks/U12c.md)
- [x] [U12b Events page: create and edit](tasks/U12b.md)
- [x] [U12a Events](tasks/U12a.md)
- [x] [U11b Lens](tasks/U11b.md)
- [x] [U11a Camera dropdown, make and model](tasks/U11a.md)
- [x] [U10b Find rolls by film stock](tasks/U10b.md)
- [x] [U10a Record a roll's film stock](tasks/U10a.md)
- [x] [U9b Find rolls by camera](tasks/U9b.md)
- [x] [U9a Record a roll's camera](tasks/U9a.md)

### 5. Describing frames

A frame's details: what a frame has is seen at a glance on its thumbnail. Frames inherit an event, camera, film stock and lens from their roll and can have their own, as the design's metadata layering describes (section 6, D25); selecting frames lets them be given one at once.

- [ ] [FF-174 Hide a frame](tasks/FF-174.md): an eye on a thumbnail, the frame view and Set menu hide a frame from every list, site and export; "Show hidden frames" brings them back, dimmed.
- [x] [FF-170 Rotate a frame from the keyboard](tasks/FF-170.md)
- [x] [FF-102 A roll's frames grouped by event](tasks/FF-102.md)
- [x] [FF-149 Rate from a thumbnail](tasks/FF-149.md)
- [x] [FF-101 One event per frame](tasks/FF-101.md)
- [x] [FF-148 Stars on thumbnails](tasks/FF-148.md)
- [x] [U59 A frame's own date shot](tasks/U59.md)
- [x] [U58 Details edited in place](tasks/U58.md)
- [x] [U57 Inherited details shown plainly](tasks/U57.md)
- [x] [U39 Frame editing](tasks/U39.md)
- [x] [U38 Delete selected frames](tasks/U38.md)
- [x] [U17 Events across rolls](tasks/U17.md)
- [x] [U16 Assign to selected frames](tasks/U16.md)
- [x] [U37 Many frames in one save](tasks/U37.md)
- [x] [U15 Frames' own details](tasks/U15.md)
- [x] [U36 A frame's resolved details](tasks/U36.md)
- [x] [U35 Meta resolver](tasks/U35.md)
- [x] [U14 Select frames](tasks/U14.md)
- [x] [U33 Rotate a frame](tasks/U33.md)
- [x] [U28a Delete a frame from the frame view](tasks/U28a.md)
- [x] [U32 A roll's notes](tasks/U32.md)
- [x] [U29 Describe a frame](tasks/U29.md)
- [x] [U27 A frame's details and versions](tasks/U27.md)
- [x] [U26 Open a frame](tasks/U26.md)

### 6. Versions and scans

A frame has more than one version: a low-res scan to preview it, a hi-res raw scan of the negative or slide, and a processed final (design section 8.2), each a kind chosen as it's added (D48). The version shown is chosen with a star, and frames can be marked to scan. Versions are added one frame at a time for now; adding many frames' raw scans together is for later (FF-131).

- [x] [FF-103 Choose the version shown](tasks/FF-103.md)
- [x] [FF-104 Mark frames to scan](tasks/FF-104.md)
- [x] [U70 Many versions as an icon](tasks/U70.md)
- [x] [U69 Own details or notes as an icon](tasks/U69.md)
- [x] [U20 Raw scans as versions](tasks/U20.md)
- [x] [U64 Version kinds](tasks/U64.md)
- [x] [U28b Delete a version](tasks/U28b.md)
- [x] [U61 Versions in a column](tasks/U61.md)
- [x] [U34 Add a version](tasks/U34.md)
- [x] [U60 The first version is shown](tasks/U60.md)

### 7. Roll numbering and filing

Rolls are numbered freely or from a pattern (D87, D88). Rolls are imported before their year or order is certain: each gets a number straight away, dates are set, then "Re-number rolls…" previews and renumbers only the rolls matching the current Browse filters, in shot-date order. Filed and filtered-out rolls keep their numbers (D74–D76).

- [ ] [later] [FF-157 Filter rolls by filing status](tasks/FF-157.md): show only rolls that aren't filed.
- [x] [FF-154 Import many rolls at once](tasks/FF-154.md)
- [x] [FF-159 Custom roll number pattern](tasks/FF-159.md)
- [x] [FF-153 Freeform roll numbers](tasks/FF-153.md)
- [x] [FF-108 Number rolls by date](tasks/FF-108.md)
- [x] [FF-107 Mark a roll as filed](tasks/FF-107.md)
- [x] [FF-158 Require a shot year when creating a roll](tasks/FF-158.md)
- [x] [FF-152 New rolls numbered automatically](tasks/FF-152.md)
- [x] [FF-106 Change a roll's number](tasks/FF-106.md)
- [x] [FF-151 Roll folders named by number and ID](tasks/FF-151.md)

### 8. Library on disk

The library stays readable in Finder: rolls, frames and versions are named by number or kind with their IDs (D66, D69).

- [x] [FF-109 Originals read-only](tasks/FF-109.md)
- [x] [FF-155 Frame and version folders named by number and kind](tasks/FF-155.md)

### 9. Settings and the FilmFile folder

The author and copyright, set on first run and changed later (no name, D44; no labs, D35; no licence yet, D42), and everything FilmFile keeps in one folder chosen once: the library (the archive) and, beside it, its settings and what's made from it (D57, D65).

- [x] [FF-150 Settings for the whole FilmFile folder](tasks/FF-150.md)
- [x] [FF-105 The FilmFile folder](tasks/FF-105.md)
- [x] [1b.2 First-run setup](tasks/1b.2.md)
- [x] [1.4.2 Archive routes](tasks/1.4.2.md)
- [x] [1.3.1 Archive](tasks/1.3.1.md)
- [x] [ArchiveRepository](tasks/ArchiveRepository.md)

### 10. Desktop app

FilmFile as a Mac app, opened from the Dock rather than by starting a service and opening a browser (D54). Electron runs the service as it is, in a separate process (`utilityProcess`) on a free port of `127.0.0.1`, and opens a window on it; the web UI and API don't change, and still work from a browser while the app is open. Electron 45's own Node.js (24) runs the service's TypeScript directly, as Node 26 does, so nothing is bundled to run it from source; the packaged app bundles it, and leaves sharp's native files outside its app archive, which they can't be loaded from. Signing, updates and other platforms are for later.

- [ ] [FF-161 An Intel Mac build](tasks/FF-161.md): the packaged app also built for Intel Macs.
- [ ] [FF-139 Windows and Linux](tasks/FF-139.md): the app for Windows and Linux.
- [ ] [FF-140 No open port](tasks/FF-140.md): a private protocol instead of a port on 127.0.0.1.
- [ ] [later] [FF-137 A signed and notarised Mac app](tasks/FF-137.md): signed with a Developer ID and notarised.
- [ ] [later] [FF-138 Updates](tasks/FF-138.md): the app updates itself.
- [x] [U84 A packaged Mac app](tasks/U84.md)
- [x] [U83 Choose the archive](tasks/U83.md)
- [x] [U82 FilmFile opens in its own window](tasks/U82.md)

### 11. Integrate with NegPy

The round trip of design section 9: a roll's raw scans go where NegPy can find them, and NegPy's exports come back as Finals by themselves. NegPy can't be told to open files from outside (no command line, URL scheme or other way in), so FilmFile keeps a folder of rolls, `Editors/NegPy/` in the FilmFile folder (FF-105), which NegPy imports once with "Import Subfolders as Rolls…" and picks new rolls up from with Refresh (D51).

- [ ] [FF-112 Open a roll in NegPy](tasks/FF-112.md): "Open in NegPy" puts links to a roll's raw scans in `Editors/NegPy/`.
- [ ] [FF-113 Bring in NegPy's exports](tasks/FF-113.md): NegPy's exports in a roll's folder become Finals of their frames.
- [ ] [FF-114 Exports brought in by themselves](tasks/FF-114.md): the service watches the NegPy folder and brings exports in as they appear.
- [ ] [FF-115 NegPy's recipes kept](tasks/FF-115.md): NegPy's `.negpy` edit is kept with each Final it made.
- [ ] [later] [FF-136 Exports that didn't match](tasks/FF-136.md): choosing frames for NegPy exports that didn't match one.

### 12. Exports

Getting frames out as files, simplest first, all through one Export dialog (D97). One frame from the frame view, then the frames selected on a roll's or an event's page, each downloaded the normal browser way (the desktop app can ask where to save, D95); then frames found by rules; then saving the same choices as an export: a saved definition of a set of exported files, a selection of frames (rules, and frames added or left off by hand, shared with sites, D93) with how they're made, built into `Exports/<export>/` whenever you like, always from the archive as it is, making again only what changed, and optionally keeping itself up to date (D94).

- [ ] [FF-165 Export a frame](tasks/FF-165.md): an Export button in the frame view, downloading the frame as a JPEG at a size and quality chosen.
- [ ] [FF-118 What an export says about itself](tasks/FF-118.md): everything the catalogue knows about the frame as EXIF and XMP, or only the author and copyright, chosen in the dialog.
- [ ] [FF-166 Choose where downloads are saved in the desktop app](tasks/FF-166.md): the desktop app asks where to save a quick export.
- [ ] [FF-167 Export selected frames](tasks/FF-167.md): Export… in the roll page's selection (Bulk edit becomes Bulk actions), downloading the frames as a zip in a layout and with names chosen.
- [ ] [FF-168 Select frames on an event's page](tasks/FF-168.md): a selection mode on the event page, exporting its frames from every roll.
- [ ] [FF-164 Frame selections](tasks/FF-164.md): choose frames by rules (rating, event, roll, camera, lens, film, date shot, has a Final or Raw) with a live count and grid on a "Find frames" page, and export what's found through the same Export dialog.
- [ ] [later] [FF-116 Exports and their frames](tasks/FF-116.md): "Save as an export…" in the Export dialog, an Exports page, and an export's selection of frames, with frames pinned or hidden by hand.
- [ ] [later] [FF-117 Build an export](tasks/FF-117.md): a JPEG of each frame into `Exports/<export>/` at the size, quality, layout and names chosen, knowing when it's up to date and making again only what changed.

### 13. Sites

A site is a saved description of which frames to share (a selection of frames, shared with exports, D93) and how to present them, built whenever you like into a self-contained static website in `Sites/<site>/`, always from the archive as it is, and made again only where something changed (D91, D92). It comes after exports (group 12), whose image rendering it shares. Putting a built site on the web is a separate step.

- [ ] [FF-119 Sites](tasks/FF-119.md): a Sites page, and a site's selection of frames, with frames pinned or hidden by hand.
- [ ] [FF-120 Build a site](tasks/FF-120.md): a self-contained static site of a site's frames in `Sites/<site>/`, grouped by roll or event if chosen, knowing when it's up to date and making again only what changed.
- [ ] [later] [FF-121 Publish a site](tasks/FF-121.md): upload a built site to S3 or Cloudflare R2, and take it down again.
- [ ] [later] [FF-162 Make a site or export from the Browse filters](tasks/FF-162.md): start one from the rolls page's filters.
- [ ] [later] [FF-163 Add selected frames to a site or export](tasks/FF-163.md): pin or hide selected frames on one from the roll and event pages.

### 14. Index and maintenance

- [ ] [FF-125 `CheckIntegrity`](tasks/FF-125.md): check every file the archive lists is there and right.
- [ ] [later] [FF-126 Maintenance routes](tasks/FF-126.md): API routes for the integrity check and index rebuild.
- [ ] [later] [FF-127 Maintenance page](tasks/FF-127.md): run the integrity check and rebuild the index from the browser.
- [ ] [later] [FF-122 `CatalogueIndex`](tasks/FF-122.md): rolls, frames and equipment indexed in SQLite in the cache.
- [ ] [later] [FF-123 `RebuildIndex`](tasks/FF-123.md): rebuild the index from the archive.
- [ ] [later] [FF-124 `ListRolls` through the index](tasks/FF-124.md): the rolls list filtered and sorted through the index.

### 15. Integrate with darktable

After "Integrate with NegPy", whose folder of links (in `Editors/`, FF-105), file names and way back it reuses. darktable can be started on a folder (`darktable <folder>` opens it in the lighttable), but not while it's already running (its library is locked); it keeps edits in XMP sidecars beside each image (`DSC04412.ARW.xmp`), reads one already there when it imports a file, and exports by default to `darktable_exported/` beside the source, under the source's name. To check first: whether it writes sidecars beside a link or beside the file the link points to (if the latter, copies instead of links), and whether it writes exports in one go or a bit at a time.

- [ ] [later] [FF-145 Open a roll in darktable](tasks/FF-145.md): start darktable on a roll's folder.
- [ ] [later] [FF-146 Catalogue details for darktable](tasks/FF-146.md): catalogue details written as XMP before darktable sees a raw.
- [ ] [later] [FF-147 darktable's exports and recipes](tasks/FF-147.md): darktable's exports and sidecars brought in.

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
| Build an export (FF-164, FF-116, FF-117) | Find frames by rules and see them live; make an export of rated frames, build it and find the files in `Exports/`; rate one more frame and see the export out of date, then build again and only that file is made |
| Build a site (FF-119, FF-120) | Make a site of frames by rule (an event, rated 4 stars and up), see the frames that match, build it, and open its index in the browser: the photos are there, grouped as chosen, and building again changes nothing |
| Bulk import rolls (FF-154) | Choose a folder of two roll folders, see each roll's name, frame count, date and number in the preview, import, and find both rolls with their scans and numbers after a reload |
| Catalogue a roll (exists, FF-103) | Create a roll, add its scans, correct a frame number, reload and find it all there; give a frame a second version, choose it with its star and see it on the contact sheet after a reload |
| Renumber a roll (exists) | A tail-to-head roll renumbered as "last scan is frame 1, counting down", saved and reloaded |
| Find rolls (U6, FF-108) | Switch grid and list, group and filter by shot year, close and reopen the browse panel; number only the filtered rolls |
| Re-number rolls (FF-108) | Preview filtered rolls by shot date around filed anchors and fixed numbers; apply the changes or cancel |
| Describe a roll (U7 onwards) | Create a roll with its name, notes, date, scans, camera, film stock and lens, then find it grouped and filtered by each |
| Organise by event (U12a–U12c, FF-130) | Create an event, put rolls in it, and browse to them by event; give it a date on the Events page; open it to see its frames from every roll, grouped by roll; later, an event inside another, whose frames show under its parent too |
| First run (1b.2) | On an archive never set up, any page asks for setup first; give the author and see the copyright made from it, land on the page asked for, then change the copyright, be taken back to the rolls, and find it in Settings after a reload. Runs against a server of its own, since it needs an empty archive |
| Bulk edit (U16, U17, FF-102) | Select a run of a roll's frames, give them another camera and put them in an event, then find them marked as having their own, with the camera in their details, the roll's other frames left as they were, and just those frames on the event's page; the roll's page then shows a label for each event with its frames under it |
| Desktop app (U82–U84, FF-105) | The app opens FilmFile in its own window on the Rolls page, its page can't use Node.js or open windows, quitting stops the service, and a second copy doesn't start; on first launch it explains and asks for the FilmFile folder, refuses folders of other files and archive folders, makes a Library in an empty one and remembers the choice; Open FilmFile Folder… switches; Show FilmFile Folder in Finder opens it; a folder gone missing or no longer a FilmFile folder is asked for again. Launches the app itself, on folders of its own, answering its dialogs; and, once built, the packaged app serves the UI and makes thumbnails |

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
| D7 | ~~Roll numbers are `YYYY-NNN` (e.g. `2026-014`), stored under `rolls/YYYY/YYYY-NNN/` once filed (D66). `YYYY` is the year shot; `NNN` is the next free number in that year when catalogued. No other formats.~~ Replaced by D76. | 1.1.1, 1.2.1 |
| D8 | ~~The API never invents a roll number; `CreateRoll` requires one. The UI suggests the next free number for a year, worked out from the roll list, but the field starts empty.~~ Replaced by D67. | 1.3.3 |
| D9 | Roll lists sort by roll number by default, or by shot date when chosen. Roll shot dates are optional. | FF-122, FF-124, 1b.6 |
| D10 | ~~A roll number can be changed only by an explicit rename, which moves the roll's folder. The ULID is unchanged.~~ Replaced by D66. | 0.4.1, 1.3.15, 1c.2 |
| D11 | The API has no import workflow. A roll is created first, then each frame is created and its lab scan uploaded as a version (D13); the UI drives the import. Frame numbers are optional on creation and can be set later. Creating a frame is an append that doesn't need `If-Match`; a scan whose hash is already in the roll returns 409, so retries are safe. Frames can be added to a roll that already has frames. | 1.3.6, 1.4.4, 1b.4, 1b.5 |
| D12 | Frames and rolls can be deleted as explicit, confirmed actions (any roll, not only an empty one: D38). Nothing is permanently deleted: deleted items move into `deleted/` in the archive, one dated folder each with the files and their JSON, and only the user empties it. No restore in the UI in Phase 1. | 0.4.1, 1.2.3, 1.3.16, 1c.2, U38 |
| D13 | Image data and metadata have separate endpoints. Frames are JSON; images are uploaded as versions of a frame (`POST …/frames/{frameId}/versions?file=…`, raw body). Versions have ULIDs and no `kind`; `defaultVersion` and `parents` refer to version IDs, never paths. Phase 1 uploads lab scans only. A frame with no versions is valid. `defaultVersion` is optional; when unset the newest version is shown. A single version can be deleted into the holding area. Originals are read by version ID. | 1.1.1, FF-125, 1.3.6, 1.3.11, 1.3.16, 1.4.3, 1.4.4, 1b.7, 1b.8 |
| D14 | No "preview" versions: on-screen images are generated previews of the frame's shown version, cached outside the archive. Every version records `width` and `height`, read by the `ImageInspector` port at upload. | 1.1.1, 1.2.7, 1.3.6 |
| D15 | A frame's `defaultVersion` (optional version ID) is the version the UI shows; when unset, ~~the newest~~ its first version is shown (D46). It lives on the frame rather than as a flag on versions, so there can only be one. Set from the frame view. | 1.1.1, FF-125, 1b.8 |
| D16 | ~~Versions have no `kind`~~ (replaced by D48): a version is a version, and `defaultVersion` decides what's shown. How Phase 2 tells raws, masters and lab scans apart where behaviour differs is an open question; a `source` attribute recording where a file came from may be added then. | 1.1.1, S1.5 |
| D17 | ~~Files are stored by version, not by kind: `frames/<frame>/<version>/<original name>`, each folder named by the last 8 characters of the ULID and unique within its parent. Same-named files never clash, sidecars sit beside their file, and deletes move one folder. NegPy can build a virtual roll from frames anywhere, so it doesn't need a `raw/` folder.~~ Replaced by D69. | S1.5, 1.2 |
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
| D35 | No labs are stored: `archive.json` holds the archive's name and archive-wide defaults (author, copyright, licence) only. Lab scans are recognised by their file name's shape as now and kept under their own names; scan direction is fixed by renumbering, not configured. | 1.3.1, 1b.2 |
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
| D46 | A frame shows its first version, its lab scan, unless one is chosen to show: a later camera raw or edit doesn't take its place by being added. Choosing which version is shown is a star on each version in the frame view (FF-103); choosing the first records no choice, so it still means the first if that is deleted. Replaces D15's newest. | U60, U61, U34, U28b |
| D47 | A frame can have its own date and time shot, in place of its roll's, like its camera, lens and events: a roll can be shot over several days. It's resolved and shown with the other details. | U59 |
| D48 | A version is a kind: Scan (ready to view, at any resolution), Raw scan (the negative or slide as scanned, before processing) or Final (processed), chosen as it's added and changeable later. Resolution isn't a kind: it's measured from the image and shown. Replaces D34's `source` and settles D16's open question. | U64, U20, FF-112 |
| D49 | A thumbnail has one icon for whatever a frame has of its own, details or notes, rather than one for each, to keep small thumbnails uncluttered; its name says which. | U69, FF-148 |
| D50 | A frame is in at most one event of its own, as a roll is, replacing D25's several: the browser only ever gave one, and a day inside a trip is a sub-event (FF-130), whose frames are in its parent too. Each frame then sits under one label when a roll is grouped by event (FF-102). | FF-101, FF-102, FF-130 |
| D51 | A roll is opened in NegPy through a folder of symbolic links outside the archive, one subfolder per roll, imported once in NegPy as a parent of rolls and refreshed there. NegPy has no command line or other way in; it reads through links, writes exports and `.negpy` files beside the link (keeping the path it was given), and refuses to export over a source it reaches through a link. Outside the archive, because NegPy writes beside its files and can move them to the Trash; originals are made read-only as a guard. Links over clones because the archive may be on another drive. Settles FF-112's zip-or-folder question. | FF-112, U73, FF-109, FF-113 |
| D52 | Settings that belong to a computer, not the archive, such as the FilmFile folder (D57, D63), are kept in a settings file in the OS config directory: a path on one computer means nothing on another, and the archive is synced. | U73 |
| D53 | The NegPy folder is watched, as bringing exports in by themselves needs it; D37 stands for the archive, whose files are still validated when read. | FF-114 |
| D54 | FilmFile becomes a desktop app with Electron, whose main process runs the service, unchanged, in a `utilityProcess` on a free port of `127.0.0.1` and opens a window on it. The service keeps its Host and Origin checks, a browser can still use it, and a crash or a long sharp job in the service doesn't freeze the window. The service runs while the app is open, not in the background (design 13.11). A private protocol with no port is for later (FF-140). | U82, U83, U84, FF-140 |
| D55 | ~~The app is packaged with Electron Forge, Electron's own tool, which puts its first-party packages (packager, rebuild, fuses, signing, notarising) together, rather than electron-builder.~~ Replaced by D56. | U84, FF-137 |
| D56 | The app is packaged by a script of our own with `@electron/packager` and `@electron/fuses`, the first-party packages Forge is made of, rather than Forge itself: Forge needs pnpm's flat, hoisted `node_modules`, and its disk image maker brings native install scripts. The service is bundled with rolldown (already installed with Vite) because Node won't strip types from TypeScript inside `node_modules`, where the contracts package would be; the disk image is made with macOS's own `hdiutil`. Replaces D55. | U84, FF-137 |
| D57 | Everything FilmFile keeps is in one FilmFile folder, chosen once per computer: `Library/` (the archive; with `settings.json`, D65, the only parts backed up and synced), `Exports/`, `Sites/` and `Editors/`, which are made from the library and can be made again. Caches stay in the OS cache folder. Replaces U73's separate NegPy folder setting. | FF-105, FF-117, FF-120, FF-112 |
| D58 | ~~Folder names in the library stay IDs (D17), so renumbering never moves an original: renames would make backup and sync upload raws again (and pay Glacier's 180-day minimum twice) and break links. The library is made easy to find your way around instead, with a `contents.txt` in each roll's folder and a `Browse/` folder of links named by frame number.~~ Replaced by D69. | FF-110 |
| D59 | ~~A roll's number can be locked once its sleeve is labelled, and is then never changed. Before that, a year's unlocked rolls can be renumbered to follow their shot dates, after the year's locked rolls, with a preview first.~~ Replaced by D68. | FF-106, FF-107, FF-108 |
| D60 | ~~Exports are made files, kept in step by the service in `Exports/`: one JPEG per frame marked for export, from the version shown, carrying the frame's details as EXIF and XMP written by sharp. They're never originals, so remaking or removing one is safe; raws are never written to.~~ Replaced by D93 and D94. | FF-116, FF-117, FF-118, FF-144 |
| D61 | ~~An event's site is static HTML, CSS and web-sized images made into `Sites/`, showing the event's frames rated at least a chosen number of stars, with frames added or left off by hand. No GPS, no originals, and no metadata but author and copyright. Publishing uploads it to an S3 bucket with an AWS profile from `~/.aws`; FilmFile keeps no keys.~~ Replaced by D91 and D92. | FF-119, FF-120, FF-121 |
| D62 | A thumbnail shows a frame's rating as filled stars at its top left, straight on the picture, and nothing for a frame with no rating. Pointing at it shows all five, the rest outlined, and pointing at a star previews that rating in a dimmer amber; a click rates the frame rather than opening it, and clicking the current rating clears it, as in the frame view (D39). The five stars sit in the same place as the plain ones, with no box behind them, so the filled ones don't move. Rating on thumbnails is by mouse on the roll page and the event page only: on touch, from the keyboard and in the filmstrip (whose tiles are small, and which sits beside the frame view's own stars), frames are rated in the frame view. The stars give way to the checkbox while bulk editing. Every thumbnail (roll page, event page, filmstrip) shows the same marks. | FF-148, FF-149 |
| D63 | The service needs `FILMFILE_FOLDER`, a FilmFile folder, and its library is the folder's `Library/`; `FILMFILE_ARCHIVE` goes. Only a valid folder opens: an empty one (the service makes `Library/`) or one with a `Library/`, so a library that has moved or whose drive isn't mounted is never quietly replaced by an empty one. An archive that isn't in a FilmFile folder isn't opened. Only `Library/` is made at first; each other folder is made by the task that first needs it. The service checks, since a browser or development run has no dialogs, and the desktop app checks first only to show its own. | FF-105 |
| D64 | A folder path is set only by the environment (`FILMFILE_FOLDER`) or the desktop app's native folder chooser, never through the API, so no request can point the service at a folder. It's read back as one read-only field, `folder`, of `GET /api/settings`, so Settings can show it: the one exception to the rule that responses carry no absolute paths, since the user chose it and it's their own machine. It isn't stored in `settings.json`. | FF-105, FF-150 |
| D65 | The archive's details (id, author and copyright) move out of `Library/archive.json` into a `settings.json` at the FilmFile folder's top level, and the API is `/api/settings`, so one file and one resource hold everything FilmFile-wide that's coming (export recipes, site defaults, the S3 bucket), not just the library's defaults. It's backed up and synced with `Library/`. Values that differ on each computer (the folder, an AWS profile) stay out of it (D52). | FF-150, FF-121 |
| D66 | Every roll's folder is `rolls/YYYY/<roll number>-<ID>/` (its number and the last 8 characters of its ULID, hyphenated), filed or not, renamed whenever its number changes; the ID keeps names unique, so rolls can swap numbers without a clash, and filing renames nothing. Rolls are found by their `roll.json`, never by the folder's name, so old-style and half-renamed folders keep working. Renames make backup and sync see the files as new, but they mostly happen while a roll holds only the lab's small scans. Replaces D10. | FF-151, FF-106, FF-107, FF-108, FF-153, FF-159 |
| D67 | ~~A new roll is numbered automatically with the next free `YYYY-NNN` (one more than the year's highest, counting unreadable rolls' folders), the year from its date shot or this year's, and can be changed before it's filed. New roll fills it in, worked out in the page from the rolls it has; the service has its own copy of the rule for a roll created with no number, so the rule is written twice and tested with the same cases.~~ Replaced by D73. Replaces D8. | FF-152 |
| D68 | ~~Marking a roll as filed fixes its number for good. "Re-number rolls…" renumbers every roll that isn't filed so that, in each year, numbers follow dates shot, after that year's filed rolls; rolls with no date keep theirs. So a roll filed later always goes after the negatives already on the shelf, even if it was shot earlier. Patterns other than `YYYY-NNN` come later (FF-159).~~ Replaced by D74. Replaces D59. | FF-107, FF-108, FF-159 |
| D69 | A frame's folder is `<frame number>-<ID>` (`unnumbered-<ID>` without one, the number cleaned to letters, digits and hyphens) and a version's `<kind>-<ID>`, renamed when the frame is renumbered or the kind changes, so the library reads in Finder. `roll.json` records each version's path, updated in the same save as a rename; a rename cut short isn't recovered automatically. Files keep their original names and are never changed. Renames cost a re-upload in backup, rare once raws are added. Replaces D17 and D58. | FF-155 |
| D70 | Roll numbers are unique, enforced by the roll repository under a lock: creating a roll, and changing a number, which only the repository's `saveRenumbered` does (`save` and `change` never change one), refuse another roll's number, so no two requests can both take one. A number that's taken is a 422 on `roll`, leaving 409 for "changed since it was read". A number's year needn't match the year shot, and renumbering never asks or warns, even for a roll with raws. Rolls can no longer swap numbers one save at a time; a batch operation does it (FF-108). | FF-106, FF-108, FF-153, FF-159 |
| D71 | `roll.json` stores `filed: true` only for filed rolls; its absence means unfiled. Roll API responses always include a boolean `filed`, and `PATCH` can set or clear it. Changing the number of an already-filed roll is a 422 validation failure; 409 remains for a stale version token. | FF-107, FF-108 |
| D72 | A filed roll has a padlock named "Filed" after its number on its card in the rolls view and in the roll heading; individual frame thumbnails and list rows have no padlock. In Edit details the number remains visible as non-editable text with the padlock. Marking is immediate; unmarking requires an in-page confirmation with a warning. | FF-107 |
| D73 | Every newly created roll must have a valid shot date with at least a year. `POST /api/rolls` refuses a missing `shot` rather than assigning the current year; automatically assigned numbers use the shot year. Replaces D67's no-date fallback. | FF-152, FF-158, FF-108 |
| D74 | Filed roll numbers never change. "Re-number rolls…" changes only unfiled rolls matching the active Browse filters; filtered-out rolls keep their numbers, which remain occupied. The shot date determines each selected roll's destination year; in that year numbering starts at 001 or after the highest filed number in that number-year, leaves gaps below that filed number unused, and skips numbers held by filtered-out rolls. A filed roll anchors the year in its number, not its shot date. | FF-107, FF-108 |
| D75 | Browse Years, its counts, and "Group by Year" use a roll's shot date. The active Browse filters define which rolls "Re-number rolls…" may change; changing a filter while previewing cancels the preview. | U6, FF-108 |
| D76 | Roll number suffixes are one or more digits; the width is a minimum of three for automatically assigned numbers, so `2026-001` can grow to `2026-1000`. Manually entered spelling is preserved, but suffixes with the same numeric value are equivalent for uniqueness and sort numerically. FF-159 lifted FF-108's 001–999 limit for “Re-number rolls…”; the service's own number for a create with none given still stops at 999. Replaces D7. | FF-106, FF-108, FF-152, FF-153, FF-159 |
| D77 | The filesystem roll repository uses one in-process lock for every roll read and mutation, so a versioned listing stays consistent while a batch is validated and applied. It serializes unrelated roll operations; direct filesystem edits and other processes are outside the lock. | FF-108 |
| D78 | A batch renumber attempts to restore original roll files and folders when a filesystem operation fails. It is not crash-atomic and has no startup recovery; if rollback is incomplete, the service surfaces an error. | FF-108 |
| D79 | Frame folder labels keep ASCII letters, digits and hyphens; each other character becomes `_`, and a leading hyphen is prefixed with `_`. Empty frame folders are created lazily with the first version. | FF-155 |
| D80 | Before release, only the labeled frame/version folder layout in D69 is supported. ID-only frame/version folders are not migrated or guaranteed to work; no backwards-compatibility path is needed. | FF-155 |
| D81 | A frame/version folder rename fails without changing `roll.json` if its source is missing or its destination is occupied. Ordinary move/save errors trigger best-effort rollback; a crash or incomplete rollback isn't recovered automatically. | FF-155 |
| D82 | Existing NegPy links are not rewritten during a frame/version folder rename. The next explicit "Open in NegPy" rebuilds links whose source paths changed. | FF-112, FF-155 |
| D83 | Version responses expose the original file basename as `fileName`, never the filesystem path. The UI can label versions without learning the archive's folder layout. | FF-155 |
| D84 | A frame has one optional own event, stored as `event` in `roll.json` and represented singularly in frame and resolved-details API responses and updates. `null` uses the roll's event. Pre-release `events` arrays are ignored rather than migrated; nested event ancestry remains FF-130. | FF-101, FF-102, FF-130 |
| D85 | `toScan` is a persistent frame selection, stored only when true and returned by the API as a boolean. Raw scans and Finals change its thumbnail status to “Scanned” but do not clear it; deleting the last such version makes it pending again. The FF-131 scan list uses only marked frames without Raw scans or Finals. | FF-104, FF-131 |
| D86 | A pending mark uses a neutral scanner icon named “To scan at higher resolution”; a marked frame with a Raw scan or Final uses the same scanner with a check in the orange theme color, named “Scanned”. The frame-view toggle is an icon beside the other actions, named “Mark to scan” or “Marked to scan”; it uses the yellow theme accent whenever marked, regardless of scan completion. The roll heading shows pending count as `N frames (M to scan)` only when nonzero. Bulk feedback is “2 frames marked to scan.” or “Scan mark removed from 2 frames.”, with singular grammar for one. | FF-104 |
| D87 | A roll number is any non-empty text up to 100 characters after trimming surrounding whitespace. The exact remaining text is stored; only its folder label is sanitized using D79's safe-label rule. Numbers are unique case-insensitively, with D76's numeric-suffix equivalence, and lists sort naturally without case. New roll folders use shot year as their parent; existing folders keep their current parent permanently. | FF-153 |
| D88 | The archive-wide roll-number pattern is stored in Settings, defaulting to `{year}-{n:3}` for older settings. It has fixed text, one minimum-width sequence token, and optional `{year}`, `{month}`, `{day}` tokens from the shot date and `{event}` (the event's slug). It suggests numbers on New roll and in “Re-number rolls…” only; an API create without a supplied number keeps its existing default. Counters reset for the distinct values of date tokens present, or are global without date tokens; New roll suggestions advance after the highest matching value, never reuse gaps, and skip occupied labels. “Re-number rolls…” preserves D74's filed and filtered-out anchors and shot-date order, using the pattern's date-token values as groups. Month/day/event tokens require that precision or an event on every existing roll before saving the pattern (and "Re-number rolls…" needs them); creating and editing a roll don't enforce it (D89). Saving a pattern does not renumber rolls; “Re-number rolls…” applies it explicitly. | FF-159 |
| D89 | Creating or editing a roll doesn't refuse one that lacks the month, day or event the roll number pattern uses; the pattern can only be saved while every roll has them, and "Re-number rolls…" stops with a message while a roll lacks them. So rolls can be imported before their details are known and numbered once they are. Relaxes D88. | FF-154, FF-159 |
| D90 | Importing many rolls: each folder dropped or chosen that holds a JPEG becomes a roll, and one that holds none contributes its subfolders that do (so one folder of roll folders, or several roll folders, can be dropped) named after its folder, dated from a year (and month and day) in its name or else this year, numbered from the pattern in Settings in natural name order, with "MM", "DD" or "event" in a number for what's missing. It runs one roll and one scan at a time, keeps going past failures, can be cancelled without undoing what's done, and doesn't detect folders already imported. | FF-154 |
| D91 | A site is a saved definition in `Library/sites/<slug>.json`, not tied to an event: a name and a selection of frames (D93), and how it's built. A site is always live, worked out from the archive as it is. v1 is one gallery. Replaces D61's event sites. | FF-119 |
| D92 | Building a site writes a self-contained static site (HTML, CSS, a small script and web-sized JPEGs, relative links, no GPS and no metadata but author and copyright) into `Sites/<slug>/`, made from the version shown with the same rendering as exports. Each image's name carries a hash of what it's made from and `site.json` records the frames and those hashes, so the site says whether it's up to date and only images whose inputs changed are made again; a build is swapped in whole, so a failed one leaves the site as it was. It comes after exports, and publishing (S3, then Cloudflare R2) is a separate, later step with its own per-computer targets (D52). | FF-120, FF-121 |
| D93 | A selection of frames is a list of rules, all of which a frame must match, each with the control that suits it (a multi-select of events, rolls, cameras, lenses or film stocks; rated at least N; shot on or after and on or before a date, compared at the limit's precision; has a Final or a Raw scan), and frames always included or never included by hand, which override the rules. The rules are a list so sections and OR groups could come later. It is always live, never frozen. Sites and exports each hold their own copy of a selection and share the rules, the rule editor and the grid, found first on a Find frames page. | FF-164, FF-116, FF-119 |
| D94 | An export is a saved definition in `Library/exports/<slug>.json`: a selection (D93) and one recipe (size, format and quality, layout, file names, metadata: everything known about the frame, or only author and copyright), built on demand into `Exports/<slug>/` from the version shown, with a manifest of what each file was made from, so it says whether it's up to date and makes again only what changed; it can optionally keep itself up to date. Several sizes are several exports. Replaces D60 and the mark on frames for export, and folds in FF-144's recipes. | FF-116, FF-117, FF-118 |
| D95 | A frame, or the frames selected on a roll's or an event's page, can be exported once, without a saved export: a dialog with the export recipe's choices (starting from an export's or the last used), making the files through the same rendering and downloading them the normal browser way, one frame as a JPEG and several as a store-only zip streamed as it's made; nothing is written to disk by the service. The desktop app asks where to save a download with its own save dialog, so the service never writes outside the FilmFile folder because a page asked it to. Saved exports (D94) are always made in `Exports/<slug>/`. | FF-165, FF-118, FF-166, FF-167, FF-168 |
| D96 | Originals are made read-only so nothing reaching them (NegPy through links, a file manager) can overwrite them in place: each version's image file, as it's stored and, once when the service starts, every one already in the library, by clearing its write bits; never JSON, sidecars, recipes or folders. It guards against overwriting, not against deleting or moving, which a program with write access to the folder can still do; a failure to change permissions is skipped and logged, never an upload failure. Refines D51's guard. | FF-109, FF-112 |
| D97 | Every way of exporting uses one Export dialog: a "Frames" line (one frame, the frames selected on a roll's or an event's page, or the rules found on the Find frames page, expandable to edit them), the recipe (size, quality, metadata, and layout and file names for several frames) and an output: "Download" now, or "Save as an export…" once saved exports exist. A saved export's page is the same form with a name. So a frame, a hand-picked selection and a search are all one kind of selection (D93, with frames chosen by hand as a rule's values). | FF-165, FF-167, FF-168, FF-164, FF-116 |
| D98 | A frame can be marked as in no event, even when its roll has one, by its own `event` being `false`: a frame's event is a slug, `null` for its roll's (as before) or `false` for none, so no magic string can clash with a slug and a check that forgets `false` is a type error. Only a frame can have it, never a roll. It isn't written into exports; sites and exports grouped by event put every frame in no event, marked or never given one, under "No event set". | FF-173, FF-120 |
| D99 | A frame can be hidden: its own state, `hidden: true` in `roll.json` beside `toScan`, stored only when set. A hidden frame is left out of every list of frames (roll and event pages, counts, grouping, the browse panel, the frame view's stepping) and never included in a site or export, however its selection finds it; a page can show its hidden frames, dimmed, with `?hidden=show` in its address, not remembered once you leave. It keeps its number, files and details, and goes with its roll. It is not a way to leave a frame out of one site only (FF-119). | FF-174, FF-119, FF-165 |

**Still open:** see `docs/design.md`, section 15.

---

## Replaced or dropped

Tasks from the first plan that turned out differently:

- [-] [FF-110 A contents file in each roll's folder](tasks/FF-110.md): *dropped: folders named by number and kind (D66, D69) say which frame and version each is.*
- [-] [FF-100 Stars on thumbnails](tasks/FF-100.md): *split into FF-148 (showing) and FF-149 (rating by clicking).*
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
