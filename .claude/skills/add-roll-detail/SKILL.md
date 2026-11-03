---
name: add-roll-detail
description: Checklist for giving FilmFile rolls a new detail kept as its own record and chosen from a list (like camera, film stock, lens and event) — every file to touch, backend to browser tests. Use when adding a detail such as a location, tag, lab or developer.
---

# Add a roll detail

Cameras, film stocks, lenses and events were each added this way; copy the
nearest one (lens for equipment, event for something that isn't). Do the
backend, then the UI, each test first. Before starting, ask the user which
fields the record has and which are required (AskUserQuestion), and record
the answer as a decision (see the write-task skill).

Names below use `thing` / `Thing`; `<kind>` is the plural folder or route.

## Backend (`apps/backend`)

1. **Domain** `src/domain/<area>/thing.ts`: the type (`slug: Slug` plus its
   fields) and, if it's shown as more than one field, `thingLabel()`; the slug
   is made from the label with `slugFor` (`src/domain/shared/slug.ts`). Unit
   test the label.
2. **Roll** `src/domain/rolls/roll.ts`: `readonly thing: Slug | null`.
   Inherited details (equipment) live in roll.json's `meta`; facts about the
   roll (event) are top-level fields.
3. **Port** — equipment: add `listThings/getThing/createThing` to
   `application/ports/equipment-repository.ts`; anything else: its own port.
   Editable records also need `get` returning `{ thing, version }` and
   `save(ctx, thing, expectedVersion)` (see `event-repository.ts`).
4. **Adapters**: `adapters/outbound/filesystem/thing-file.ts` (Zod persistence
   schema, `schema: 1`, new fields `.nullable().default(null)`, fixed key
   order) and the filesystem and in-memory repositories.
5. **Contract suite** `test/contracts/*-contract.ts`: create/get, slug clash
   keeps the first, list order, empty list, unknown slug (and saves with
   versions if editable). Builder in `test/support/builders.ts`
   (`aThing(...)`), and add `thing: null` to `aRoll`.
6. **Use cases**: `ListThings`, `CreateThing` (trim, required fields →
   `validation-failed` with a path, slug clash → `already-exists`);
   `application/use-cases/rolls/known-thing.ts`; `CreateRoll` and
   `UpdateRoll` take `thing` (constructor gains the repository if new).
   Update every `setUp()` that constructs them.
7. **roll.json** `adapters/outbound/filesystem/roll-file.ts`: parse and write
   the field; extend the fast-check arbitrary and the meta/old-file tests in
   `roll-file.test.ts`; add it to the expected file in
   `test/adapters/filesystem/filesystem-roll-repository.test.ts` and
   `test/api/rolls.test.ts`.
8. **Contracts** `packages/contracts/src/<area>.ts`: `thing`, `thingList`,
   `createThingRequest` (lengths, enums); `roll.thing`, and `thing` in
   `createRollRequest` (optional) and `updateRollRequest` (nullable,
   optional). Use `slug` from `slug.ts`. Then `pnpm generate`.
9. **HTTP** routes file, `RollUseCases`/`*UseCases` interface,
   `create-app.ts`, `composition/use-cases-for.ts`, `compose-local.ts`,
   `compose-in-memory.ts`, `roll-dto.ts`. API tests: create, file on disk,
   409, 422 cases, list, and the roll's field (recorded, must exist).

## Web (`apps/web`)

10. `src/<area>/use-things.ts` (query, `thingLabel`, `thingName(list, slug)`),
    `thing-choice.ts` (`NewThing`, `PickOrAdd<NewThing>`, `blankThing`),
    `thing-field.tsx` (`PickOrAddSelect` plus a "New thing" fieldset with
    `RequiredMarker`s), `choose-thing.ts` (none / existing / create; on 409
    reload the list and use the match, else a message).
11. **Forms**: `rolls/new-roll-page.tsx` (state, choose before POST,
    invalidate the query) and `rolls/edit-details-panel.tsx` +
    `rolls/roll-page.tsx` `saveDetails`. Don't name state `event` — it
    shadows form handlers' `event`.
12. **Display**: `RollAbout` facts row in `roll-page.tsx`; card (`roll-card.tsx`)
    and List column (`roll-table.tsx`) if wanted.
13. **Finding rolls**, if wanted: `rolls-address.ts` (grouping and `?thing=`),
    `browse-panel.tsx` section, `rolls-page.tsx` (`Names`, `grouped`,
    filter, `headingFor`, Group by option).
14. **Web tests**: teach the shared fake service
    (`apps/web/src/testing/fake-archive.ts`) the new endpoints and the roll's
    field (and `aRoll`), then test the forms, display and browsing through the
    pages with `fakeArchive({ ... })`. Choose options by visible text with the
    `choose(label, text)` helpers.
15. **Journeys** `test/e2e/support/journeys.ts`: a `thing` / `newThing`
    option on `createRoll`; extend the journey it belongs in, with names no
    other journey uses.

## Finish

- Run the check skill with `--e2e --times 2`; take a screenshot with the
  screenshot skill.
- Tick the task and record the decision (write-task skill).
