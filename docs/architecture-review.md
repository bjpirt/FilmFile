# Architecture review

Reviewed on 2026-11-14 at commit `a16f35c`. This is a list of recommended changes in priority order, each written so it can be picked up and built without the conversation that produced it.

## How to use this document

- Work through the recommendations in order unless told otherwise. Each one stands alone except where it says it depends on another.
- Each recommendation is one or more roadmap tasks. Before building one, add its tasks with the `write-task` skill (FF-202 is R1; take the next free ID for the others) and have the acceptance criteria reviewed, as for any other task.
- All of this is "make it pretty" work except R1, R2 and R3, which change behaviour that a person or a log can see. For the rest, behaviour must not change: the existing tests stay green throughout and are the proof.
- Follow `CLAUDE.md`: test first, one task at a time, `pnpm verify` through the `check` skill, and update `docs/design.md` when a recommendation says to.
- File paths are relative to the repository root. Line counts and occurrence counts were true at the commit above; check them again before relying on them.
- If a recommendation turns out to conflict with a decision in `docs/roadmap.md`, stop and raise it instead of working round it.

## Summary

The architecture is sound and should be kept. The layers are real, the lint rules enforce them, every port has a contract suite, and the composition roots are plain and readable. Nothing here asks for a new framework, a new layer or a new dependency.

The problems are of three kinds:

1. **One hot path reads the whole archive.** Looking up a single roll parses every `roll.json`, and almost every request looks up a roll. This is the only finding with a measured cost to the person using the app.
2. **A few large files hold several jobs each**, and some rules live in a layer that makes them be written twice. The roll repository, the rolls route file and the web's roll page are the three places a first-time reader will struggle.
3. **Small drifts**: failures that are swallowed, repeated snippets, types in the wrong folder, and documents that describe things that aren't built.

| # | Recommendation | Why it matters | Size |
|---|---|---|---|
| R1 | Find a roll by its ID without reading the archive | A roll page of 36 thumbnails spends about 7.5 s on lookups at 300 rolls | Small |
| R2 | Report failures in background work | Site builds and folder exports fail with no trace anywhere | Small |
| R3 | Let browsers cache thumbnails | Every page view fetches every thumbnail again | Small |
| R4 | Bring the architecture documents back in line | `CLAUDE.md` describes a SQLite adapter that doesn't exist | Small |
| R5 | Slim the roll repository | 790 lines, three locks where one does the work, rules written twice | Medium |
| R6 | Read the archive once per request | The sites list reads every roll once per site | Medium |
| R7 | Give the web app one place per feature for API calls | 74 direct API calls in 33 files; the roll page is 1,162 lines | Medium to large |
| R8 | Split the rolls route file and remove dead branches | 806 lines; 14 guards that can never fire | Small to medium |
| R9 | Remove repeated snippets in the use cases | The same detail resolution in four places | Small |
| R10 | Tidy what sits in the wrong layer | Domain types in port files, pure functions among use cases | Small |

A section at the end lists what was looked at and should be left alone.

---

## R1. Find a roll by its ID without reading the archive

**Priority:** first. **Size:** small, one task. **Changes behaviour:** speed only.

> **Now FF-202, and refined since.** Build from `docs/tasks/FF-202.md`, not from the steps below. The task goes further than this section: the search through every folder is removed altogether (D112), so a roll in a folder not named with its ID is listed as unreadable instead of found, and no new test guards the number of files read.

### The problem

`FilesystemRollRepository.#find` in `apps/backend/src/adapters/outbound/filesystem/filesystem-roll-repository.ts` calls `#readAll`, which globs `rolls/*/*/roll.json`, then reads and Zod-parses every file, to return one roll. `get`, `save`, `saveRenumbered`, `change` and `remove` all go through it, and all of them hold the archive-wide lock while they do, so the lookups queue up one behind another.

Nearly every request needs a roll: each thumbnail, each original, each frame edit, each frame in an export.

Measured on a synthetic archive of 300 rolls with 36 frames each, on the review machine:

| Operation | Time |
|---|---|
| One `get` | about 215 ms |
| 36 `get`s, as a roll page's thumbnails ask for (serial or parallel, the lock makes them the same) | about 7.5 s |
| One `list` of everything | about 225 ms |
| 36 calls to `findRollFolder` | about 90 ms |

The code already knows this hurts: `BuildSite.#gather` has a comment saying "reading rolls one by one costs a pass over the archive each" and works round it by listing once.

### The fix

A roll's folder name ends with the last 8 characters of its ID, and `findRollFolder` in `apps/backend/src/adapters/outbound/filesystem/roll-folder.ts` already uses that: it looks in `rolls/*/*-<last 8>/roll.json` first and falls back to checking every `roll.json` only if that finds nothing. The blob store and the holding area use it. The repository should too.

### Steps

1. Read `roll-folder.ts` and the tests in `apps/backend/test/adapters/filesystem/filesystem-roll-repository.test.ts`, which already cover folders named before D66 and renames left half done. Those cases must keep passing.
2. Change `#find(id)` to:
   - call `findRollFolder(this.#archivePath, id)`; if it returns `undefined`, return `undefined`;
   - read `roll.json` in that folder with `safePath`, parse it with `parseRollFile`, and build the `StoredRoll` as `#readAll` does (roll, version token from the content, file path, content);
   - return `undefined` if the file doesn't parse, which is what happens today, since `#readAll` puts an unreadable roll in `unreadable` and `#find` never sees it.
3. Leave `#readAll` in place for `listVersioned`, `#numberTaken` and `saveRenumberedBatch`, which need every roll.
4. Leave the locking alone in this task (R5 simplifies it).
5. Check the one subtle caller: `remove` calls `#find` again after `handOver` to prove the roll has gone. It must still return `undefined` once the folder has moved to `deleted/`.

### Tests

- The roll repository contract suite (`apps/backend/test/contracts/roll-repository-contract.ts`) and the filesystem adapter tests must pass unchanged. They are the proof that behaviour is the same.
- Add one adapter test for the property being bought: with a second roll whose `roll.json` is not valid JSON sitting in the archive, `get`, `save` and `change` on the first roll still work. Today this passes too, so it is a guard, not a failing test; say so in the task.
- Do not add a timing assertion. They are flaky. If a guard on the number of files read is wanted, inject a counting reader the way `renameFolder` is already injected, but only if the reviewer asks for it.

### Done when

`pnpm verify` passes, and opening a roll in a large archive no longer scales with the number of rolls. Add a line to D77 in `docs/roadmap.md` or a new decision saying a roll is found by its folder's ID suffix first.

---

## R2. Report failures in background work

**Priority:** first. **Size:** small, one task. **Changes behaviour:** failures are logged.

### The problem

`CLAUDE.md` says "never swallow errors". Three places do:

- `SiteBuilds.#run` in `apps/backend/src/application/use-cases/sites/site-builds.ts`: `catch { update({ state: 'failed' }) }`.
- `FolderExports.#run` in `apps/backend/src/application/use-cases/exports/folder-exports.ts`: the same.
- `localStartup` in `apps/backend/src/composition/compose-local.ts`: `catch {}` around `ProtectOriginals`.

The page is rightly told only "failed", with no internals. But the error itself goes nowhere, so a failed site build can't be diagnosed. The HTTP adapter has a `ReportError` function for exactly this (`apps/backend/src/adapters/inbound/http/middleware/error-handler.ts`), but background work runs outside a request and never reaches it.

### The fix

A small outbound port for reporting an unexpected error, given to the two job runners.

### Steps

1. Test first, in `apps/backend/test/use-cases/` (or beside the existing site build and folder export tests): compose in memory with an `ImageRenderer` that throws, start a build, wait for it to finish, and assert both that the build's state is `failed` and that the error was reported. Do the same for a folder export.
2. Add `apps/backend/src/application/ports/error-reporter.ts`:
   ```ts
   /** Where an unexpected failure goes so it can be diagnosed: the log, never the client. */
   export interface ErrorReporter {
     report(error: unknown): void;
   }
   ```
3. Add adapters: `adapters/outbound/node/console-error-reporter.ts` (writes to `console.error`) and `adapters/outbound/memory/in-memory-error-reporter.ts` (keeps what it was given, with a `reported` getter, for tests).
4. Add `errors: ErrorReporter` to `Adapters` in `apps/backend/src/composition/use-cases-for.ts`; pass it to `SiteBuilds` and `FolderExports`; call `this.#errors.report(error)` in their `catch` blocks before setting the state.
5. In `composeLocal`, build the reporter from `config.reportError` when one is given, so tests that pass a `reportError` see background failures too. In `localStartup`, pass the caught error to the `log` argument or the reporter; keep the rule that it never throws.
6. Add a contract suite only if both adapters have behaviour worth pinning. A reporter that only records probably doesn't; say which way you went in the task notes. The `testing-conventions` skill says every port has one, so if in doubt add a two-line suite.
7. Add the port to the table in `docs/design.md` section 13.4.

### Not in this task

Do not unify `SiteBuilds` and `FolderExports` into a shared job framework. They are similar, but two is not enough to abstract from. One alignment is worth doing while here: `FolderExports` cancels with a boolean and `SiteBuilds` with an `AbortController`. Make `FolderExports` use an `AbortController` too, so there is one way to cancel.

Also record in `docs/design.md` section 13.5 that these two are **job runners**, not use cases: they hold in-memory state and expose `start`, `status` and `cancel` instead of one `execute`. The section currently says every use case has a single `execute`, which a reader will find untrue.

---

## R3. Let browsers cache thumbnails

**Priority:** first. **Size:** small, one task. **Changes behaviour:** a response header.

### The problem

`GET /api/rolls/{rollId}/frames/{frameId}/versions/{versionId}/thumbnail` in `apps/backend/src/adapters/inbound/http/routes/rolls.ts` sends no `Cache-Control`. Every visit to a roll fetches every thumbnail again, and each fetch looks up the roll (R1) and reads the cached WebP from disk.

The address is already a stable name for the bytes: a version's file is write-once, and the size and turn are in the query (`apps/web/src/rolls/thumbnail-url.ts` says "each turn has its own address").

### Steps

1. Read the `security-rules` skill before touching the route.
2. API test first in `apps/backend/test/api/`: the thumbnail response carries `Cache-Control: private, max-age=31536000, immutable`.
3. Set the header in the thumbnail handler. Use `private` because the service is single-user and local.
4. Check the one case that could go stale: a version deleted and the same URL asked for again. A cached thumbnail of a deleted version being shown from the browser's cache is harmless, since nothing links to it any more, but confirm that no page builds a thumbnail URL for a version it hasn't just read from the API.
5. Consider the same for the original file route (`…/file`). It is also immutable, but it can be 200 MB, so leave it unless asked.

---

## R4. Bring the architecture documents back in line

**Priority:** first, because other agents read these before every task. **Size:** small, documents only.

### The problem

- `CLAUDE.md` lists SQLite among the outbound adapters ("outbound: filesystem, SQLite, sharp, node, memory") and `better-sqlite3` in the stack. There is no SQLite adapter and `better-sqlite3` is not a dependency of any package. The first invariant ("SQLite and every other store is a rebuildable cache") reads as if one exists.
- `docs/design.md` section 13.4's port table is missing six ports that exist: `EventRepository`, `SiteRepository`, `SiteFolders`, `ExportTickets`, `ExportDestination` and `ImageRenderer`. Section 13.9's layout doesn't show `composition/use-cases-for.ts` or the sites and exports features.
- There are two architecture documents: `docs/design.md` section 13 and `docs/technical-architecture.md`. They overlap, and the second is the more accurate about what's built. Two descriptions will keep drifting.

### Steps

1. In `CLAUDE.md`: remove SQLite from the list of adapters that exist and mark `better-sqlite3` as planned (FF-122), matching how `docs/design.md` section 13.10 says "Index (planned)". Keep the invariant, reworded so it's clear the index is still to come.
2. Decide, with the user, which document owns what. The recommendation: `docs/design.md` section 13 holds the rules and the reasons (layers, the three models, how use cases and DI work, the decisions); `docs/technical-architecture.md` holds what is built (the list of ports and adapters, the request walk-through). Then move the port table to `technical-architecture.md`, complete it, and leave a link in section 13.4.
3. Add `docs/technical-architecture.md` to the "Design" bullet at the top of `CLAUDE.md` so agents know it exists.
4. Add a line to the definition of done in `CLAUDE.md`: a new port or adapter is added to the port table.

---

## R5. Slim the roll repository

**Priority:** second tier. **Size:** medium, three tasks, in this order. **Changes behaviour:** no.

`apps/backend/src/adapters/outbound/filesystem/filesystem-roll-repository.ts` is 790 lines and the hardest file in the backend to read. Three separate things make it so.

### R5a. One lock, not three

The class has `#archive`, `#lock` (per roll) and `#years`. Every use of `#lock` and `#years` is inside `#archive.run('archive', …)`, which already lets only one thing run at a time. The inner two can never be contended, so they add nesting and nothing else. D77 in `docs/roadmap.md` already describes the design as "one in-process lock".

`InMemoryRollRepository` has the same shape: `#writes` wraps every use of `#lock`.

Steps:

1. Confirm the claim by reading each method: `create`, `save`, `saveRenumbered`, `change`, `remove`. If any use of `#lock` or `#years` is found outside `#archive.run`, stop and raise it.
2. Remove `#lock` and `#years` from the filesystem repository and `#lock` from the in-memory one, un-nesting the callbacks.
3. The concurrency tests (`apps/backend/test/api/concurrency.test.ts` and the contract suite's concurrent cases) must pass unchanged.

### R5b. Renumbering rules belong in the domain

Two rules are written out in full in both adapters, with the same messages:

- "A filed roll's number can't be changed", in `saveRenumbered` and in `saveRenumberedBatch`.
- The whole validation of a batch renumbering: duplicate snapshot entries, stale versions, rolls added since the snapshot, duplicate changes, unknown rolls, and uniqueness of the resulting numbers. That is about 110 lines in each adapter.

These are rules about rolls, not about files, so the copy in the in-memory adapter is only there because the filesystem adapter has one. The two have already drifted: they treat `unreadable` entries differently.

Steps:

1. Add `apps/backend/src/domain/rolls/plan-roll-renumbering.ts` with a pure function. Suggested shape:
   ```ts
   /**
    * Checks a batch renumbering against the archive as it is now and gives the
    * rolls whose numbers really change, or why it can't be applied.
    */
   export function planRollRenumbering(input: {
     readonly current: readonly { readonly roll: Roll; readonly version: string }[];
     readonly currentUnreadable: readonly UnreadableRoll[];
     readonly expected: readonly { readonly id: RollId; readonly version: string }[];
     readonly expectedUnreadable: readonly UnreadableRoll[];
     readonly changes: readonly { readonly id: RollId; readonly roll: RollNumber }[];
   }): Result<
     readonly { readonly id: RollId; readonly roll: RollNumber }[],
     ConcurrencyConflict | ValidationFailed
   >;
   ```
   Move the checks into it in the order the filesystem adapter runs them, with the same error kinds, paths and messages, so no API test changes.
2. The check that a number is reserved by an unreadable folder (`namedFor`) uses only `sameRollNumber` and `rollFolderLabel`, both already in the domain. Move it to the domain too and call it from the plan function.
3. Add a small domain function for the filed rule, used by `saveRenumbered` in both adapters.
4. Unit-test the plan function table-style in `plan-roll-renumbering.test.ts`: one case per refusal, and the happy path. Most of these cases exist today as contract tests; keep the contract tests, since they prove the adapters call it.
5. Each adapter's `saveRenumberedBatch` becomes: take the lock, read the current rolls, call the plan function, apply the result. The in-memory one should shrink to about 20 lines.
6. The plan function must still be called inside the lock. It is called by the adapter, not the use case, for that reason.

### R5c. Move the folder-moving machinery into its own files

What's left in the filesystem repository after R5b is two blocks of rename-and-roll-back code that aren't about the repository's interface:

- Moving version folders when a frame's number or a version's kind changes: `withChangedVersionPaths`, `versionFolderMoves` and the body of `#saveChanged`.
- Moving roll folders in a batch through temporary names, with rollback: the second half of `saveRenumberedBatch`.

Steps:

1. Move the first to `adapters/outbound/filesystem/move-version-folders.ts` and the second to `adapters/outbound/filesystem/renumber-roll-folders.ts`, as plain functions taking the `renameFolder` function the class is already given.
2. Move `exists`, `isDirectory` and `removeIfEmpty` from the bottom of the repository file into one small file they can share.
3. Keep the tests where they are; they drive this through the repository and that's the right level.

After all three, the repository file should be about 300 lines: the port's methods, each short enough to read without scrolling.

---

## R6. Read the archive once per request

**Priority:** second tier, after R1. **Size:** medium, two or three tasks. **Changes behaviour:** speed only.

### The problem

After R1, looking up one roll is cheap, but several use cases still read the same things again and again within one call:

- `ListSites` (`application/use-cases/sites/list-sites.ts`) calls `SearchFrames.execute` once per site, and each call lists every roll, reads settings and lists events. Five sites means five passes over the archive to show the sites page.
- `SiteBuilds.status` (`application/use-cases/sites/site-builds.ts`) is polled while a build runs. Each poll calls `#framesOf` (a full search) and then `BuildSite.status`, whose `#gather` lists every roll again.
- `BuildSite.#gather` and `MakeQuickExport.#make` look up the event, camera, lens and film for every frame, each a file read, though most frames of a roll share them. `MakeQuickExport.#make` also reads settings once per frame.

`SearchFrames` shows the better pattern: it lists events once into a `Map`.

### Steps

1. **Split `SearchFrames` into a pure function and a loader.** Move the matching loop to the domain, for example `domain/selections/find-frames.ts`: `findFrames(selection, rolls, settings, eventLabels)` returning the same `FoundFrame[]`. `SearchFrames.execute` loads the three inputs and calls it. Test the pure function directly; the existing search API tests stay.
2. **`ListSites` loads once.** Give it the repositories it needs, load rolls, settings and events once, and call `findFrames` per site. It no longer depends on another use case.
3. **`SiteBuilds.status` loads once.** Let `BuildSite.status` and `BuildSite.execute` accept the rolls already read, or have `SiteBuilds` pass what `#framesOf` loaded. Choose whichever leaves `BuildSite`'s signature simplest; do not add a cache object.
4. **Look up equipment and events once per build or export.** In `BuildSite.#gather` and `MakeQuickExport`, list cameras, lenses, film stocks and events once into `Map`s by slug at the start, as `SearchFrames` does for events, and read settings once.

### What not to do

Do not add the SQLite `CatalogueIndex` (FF-122 to FF-124) for this. With R1 and this recommendation, the remaining cost is one pass over the archive per listing, about 225 ms at 300 rolls. Build the index when that number, measured on the real archive, is too slow, not before. Record that as the trigger in FF-122's task file.

---

## R7. Give the web app one place per feature for API calls

**Priority:** second tier. **Size:** medium to large; one task per feature, rolls first. **Changes behaviour:** no.

### The problem

Components call the generated client directly: 74 `api.GET`/`PATCH`/`POST`/`DELETE` calls across 33 files. The consequences:

- The query for one roll, `['rolls', rollId]`, is defined in four places (`rolls/roll-page.tsx`, `rolls/use-rate-frame.ts`, `frames/use-save-frame.ts` and `frames/roll-frame-page.tsx`), each with its own `queryFn`. They must agree on the shape of what's cached and nothing checks that they do.
- "Which queries does this change make stale?" is answered separately at each call site: there are ten `invalidateQueries({ queryKey: ['rolls'] })` calls, some with `exact: true`, each with a comment explaining why.
- "The roll changed since you read it" is checked by hand 24 times (`response.status === 409`).
- `apps/web/src/rolls/roll-page.tsx` is 1,162 lines with 17 `useState` calls, because fetching, saving, conflict handling, selection, renumbering, uploading and rendering all live in one component.

The equipment and events features already do this well: `equipment/use-cameras.ts` owns the query and the labels, and components just call `useCameras(api)`. Rolls, the biggest feature, doesn't follow its own app's pattern.

### The fix

For each feature, one file that owns its query keys and reads, and one that owns its writes. No new library, and no need to adopt `useMutation`: plain async functions returning a small union are enough and match what the components already expect.

### Steps for rolls (do this first, as one task)

1. Add `apps/web/src/rolls/use-roll.ts`:
   - the query keys as functions, for example `rollKey(rollId)` and `rollsKey`;
   - `useRoll(api, rollId)`, the one definition of the roll query, returning the roll with its ETag as `roll-page.tsx` does now.
2. Replace the four definitions of the `['rolls', rollId]` query with `useRoll`. Run the web tests after each replacement.
3. Add `apps/web/src/rolls/roll-changes.ts` with one function per write the roll page makes: delete a frame, delete several, set details on several, save a frame's number, save a renumbering, delete the roll, set filed. Each takes the client, the query client, the roll as read (for its ETag) and the change, and returns `'saved' | 'changed-elsewhere' | 'failed'`. Each owns its `If-Match` header, its 409 check and its invalidation, with the comment that explains the invalidation moved there with it.
4. Change `roll-page.tsx` to call them. Its handlers should become two or three lines each: call, then set local state from the outcome.
5. The page tests and the Playwright journeys must pass unchanged. This is a refactor; if a test needs changing, the behaviour changed, so stop and look.

### Then split the roll page (a second task)

With the data code gone, split what's left by mode, each in its own file beside the page: the selection mode (select, assign, delete, export), the renumber mode, and the upload drop zone with its progress. `RollAbout` and `ProposedNumber`, already separate components at the top of the file, move to their own files too. Aim for the page component to be the part that decides which mode is showing.

### Then the rest

Apply the same two-file pattern to frames (`frames/use-save-frame.ts` is 493 lines and re-reads the roll itself), sites and events, one task each, in whichever order the next feature work touches them. Do not do them all up front.

---

## R8. Split the rolls route file and remove dead branches

**Priority:** third tier. **Size:** small to medium, two tasks. **Changes behaviour:** no.

### The problem

`apps/backend/src/adapters/inbound/http/routes/rolls.ts` is 806 lines and holds every route for rolls, frames and versions: 18 routes, about 450 lines of route definitions and 330 of handlers.

Two patterns repeat in the handlers:

- `if (!isRollId(rollId)) { return c.json(notFound, 404); }`, 14 times across the file, with variants for frame and version IDs. The comment above `rollRoutes` says the schema has already checked the IDs and the guards "only give them their branded types". That is right: `ulid` in `packages/contracts/src/rolls.ts` and the pattern behind `isRollId` in `apps/backend/src/domain/shared/ids.ts` are the same regular expression. So the 404 branches can never run, and a reader has to work that out each time.
- The `If-Match` check, 8 times: read the header, return 428 if missing, call `versionFrom`.

One handler is inconsistent: `updateFrameNumbers` drops any frame ID that fails `isFrameId` with a `flatMap`, silently, where every other handler passes IDs through or refuses.

### Steps

1. **Split by resource** into three files, each with its own `…UseCases` interface and route function, mounted in `create-app.ts`:
   - `routes/rolls.ts`: list, numbering snapshot, renumber, get, create, update, delete.
   - `routes/roll-frames.ts`: create, update one, update many, delete one, delete many, details.
   - `routes/frame-versions.ts`: add, update, delete, original file, thumbnail.

   Move the shared response helpers (`json`, `image`, `versionImage`, `invalid`, `malformed`, `wrongType`, `requireJson`) to one file beside them; the other route files (`sites.ts`, `events.ts`, `equipment.ts`, `exports.ts`, `settings.ts`) define their own copies of `json` and can use it too. `pnpm generate` must produce an identical `openapi.json`: that's the check that nothing moved by accident.
2. **Replace the unreachable guards** with a function that brands or throws, since a failure would be a bug in the schema, not a client error:
   ```ts
   /** The ID as its branded type. The route's schema has checked it, so a failure here is a bug. */
   export function asRollId(value: string): RollId
   ```
   and the same for frame and version IDs and slugs, in one file under `adapters/inbound/http/`. Each handler then starts with one line instead of four. Unit-test the throwing case once. Apply it to `sites.ts` and `events.ts`, which have the same guard for slugs. Check the slug pattern in `packages/contracts/src/slug.ts` matches `isSlug` in the domain before removing those.
3. **Leave the `If-Match` check as it is** unless a helper can be written that keeps Hono's typed responses without a type assertion. Three lines repeated are better than a helper that needs an `eslint-disable`. If you try and it needs one, stop.
4. **Fix the `flatMap`** in `updateFrameNumbers` to brand with the function from step 2, so a malformed ID can't be silently dropped.

The 8-way intersection type for all use cases is written out twice, in `create-app.ts` and `use-cases-for.ts`. Export it once from `create-app.ts` as `UseCases` and use it in both.

---

## R9. Remove repeated snippets in the use cases

**Priority:** third tier. **Size:** small; one task per snippet. **Changes behaviour:** no.

`CLAUDE.md` says three similar lines beat a premature helper. Each of these is past that point.

### R9a. Resolving a frame's details, four times

This appears in `get-frame-details.ts`, `search-frames.ts`, `make-quick-export.ts` and `build-site.ts`:

```ts
resolveDetails([
  ...(settings === undefined ? [] : [archiveLayer(settings)]),
  rollLayer(roll),
  frameLayer(frame),
]);
```

It is the rule for how a frame's details are layered (design section 6), so it should be written once. Add `resolveFrameDetails(settings: Settings | undefined, roll: Roll, frame: Frame)` to `apps/backend/src/domain/details/`, test it there, and use it in all four.

### R9b. The version shown for a frame, twice

`frame.versions.find((v) => v.id === frame.defaultVersion) ?? frame.versions[0]` is in `make-quick-export.ts` and, as a private `shown` function, in `build-site.ts`. Move it to `apps/backend/src/domain/rolls/shown-version.ts` (beside `find-version.ts`) with a test, citing D15 and D46.

### R9c. Parsing a field that may be left out, about 20 times

`UpdateRoll`, `UpdateFrame`, `UpdateFrames` and `CreateRoll` repeat this for every field:

```ts
const shot =
  input.shot === undefined || input.shot === null
    ? ok(input.shot)
    : parseShotDate(input.shot);
if (!shot.ok) {
  return shot;
}
```

`UpdateFrame.execute` is 120 lines, most of it this. Add one helper beside `text-or-null.ts`:

```ts
/** Parses a value that was given; one left out (undefined) or cleared (null) passes through. */
export function whenGiven<T, U, E>(
  value: T | null | undefined,
  parse: (given: T) => Result<U, E>,
): Result<U | null | undefined, E>;
```

and an async twin for the `knownCamera`, `knownLens`, `knownFilmStock` and `knownEvent` lookups. Keep the `if (!x.ok) return x;` lines: they are the early returns the code style asks for, and hiding them would need exceptions or a combinator. `UpdateFrame`'s `event` field also accepts `false`; handle that at the call site, not in the helper.

Do R9c last and stop if the types fight back. If the helper needs a type assertion, it isn't worth it.

---

## R10. Tidy what sits in the wrong layer

**Priority:** third tier. **Size:** small; can be one task. **Changes behaviour:** no.

None of these breaks a lint rule. Each makes the folder a thing is in say the wrong thing about it.

1. **Domain types defined in port files.** `QuickExport`, `Naming`, `Layout` and `ExportOutput` are in `application/ports/export-tickets.ts`; `ExportRecipe`, `ImageMetadata` and `MetadataChoice` are in `application/ports/image-renderer.ts`. They describe what an export is, and use cases and other ports import them from there. Move them to a new `apps/backend/src/domain/exports/`, one main export per file as the code style asks.
2. **Pure functions among the use cases.** `application/use-cases/exports/` holds `zip.ts`, `export-names.ts` and `export-metadata.ts`, which do no I/O and take no ports. Move `export-names.ts` and `export-metadata.ts` to `domain/exports/`. `zip.ts` is a file format, not a domain rule, but it imports nothing and is pure, so it can go with them; the domain is the only layer where pure code with no ports belongs.
3. **An inbound adapter importing an outbound one.** `adapters/inbound/http/middleware/error-handler.ts` imports `newUlid` from `adapters/outbound/node/new-ulid.ts` for correlation IDs, going round the `IdGenerator` port. Pass a `newCorrelationId: () => string` into `errorHandler` from `createApp`'s config and supply it in the composition roots. In memory it can then be sequential, which makes the error tests deterministic.
4. **Selections depending on sites.** `SearchFrames` and `FoundFrame` import `GroupLabel` from `domain/sites/site-photo.ts` and the label functions from `domain/sites/group-labels.ts`. Selections are used by exports and events too, so the dependency points the wrong way. Move `GroupLabel` and `group-labels.ts` to `domain/selections/` (or `domain/rolls/` if that reads better) and have sites import them.
5. **`ListRolls` has two entry points**, `execute` and `executeVersioned`. Make the second its own use case, `GetRollNumberingSnapshot`, so the rule in design section 13.5 holds.

---

## Looked at and left alone

These were considered and should not be changed. They are listed so the next reviewer doesn't spend time on them, and so nobody "fixes" them in passing.

- **The layering and how it's enforced.** `eslint-plugin-boundaries` with default-deny, checked against fixtures in `test/architecture/`. This is the strongest part of the codebase.
- **Pure DI and the composition roots.** `use-cases-for.ts` is long because it's a list. A container would hide it, not shorten it.
- **Use-case interfaces defined in the route files** (`RollUseCases` and so on) and imported by the composition root. The consumer defines what it needs; that's the right way round.
- **`Result` and the domain errors**, and the single mapping to HTTP statuses in `domain-error-response.ts`.
- **The three models.** The mapping in `roll-dto.ts` and `roll-file.ts` is thin, as section 13.3 says it should be for now.
- **HTML and CSS rendering in `domain/sites/`.** It's a third of the domain by line count and arguably presentation. But it's pure, it's tested as pure functions, and moving it behind a port would add an interface with one implementation. Leave it unless a second site design arrives.
- **The roll-number pattern being worked out in the web app** (`apps/web/src/rolls/roll-number-pattern.ts`, 344 lines) while the backend only validates the grammar. This is a business rule in the client, and the two copies of the grammar "must agree" by comment only. But D88 decided it deliberately, and the alternative is a preview endpoint for something that updates as the person types. Revisit it when a second client needs numbering, or if the two grammars are ever found to disagree. A cheap guard, if wanted sooner: one shared table of pattern cases run by both test suites, as D67 once did for the old rule.
- **Uploads and originals held in memory** as `Uint8Array`, up to the 200 MB limit. Streaming would touch the `BlobStore`, `ImageInspector` and `ImageRenderer` ports. Do it when raw scans make memory a real problem.
- **No catalogue index yet.** See R6.
- **The hand-written zip writer.** About 100 lines against a dependency; in keeping with "check whether a few lines of our own would do".
- **The slug and ULID patterns written once in contracts and once in the domain.** The domain may not import contracts, so this duplication is the price of the rule. R8 step 2 relies on them matching; a test that asserts they do would be a reasonable small addition.
- **The desktop app.** `apps/desktop` imports nothing from the backend and is split into small tested files. Not reviewed in depth, and nothing stood out.
