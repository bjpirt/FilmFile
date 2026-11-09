---
name: write-task
description: How to add, split, reorder, tick off and rewrite tasks and decisions in FilmFile's roadmap (docs/roadmap.md, an index) and their task files (docs/tasks/<ID>.md). Use whenever the user asks to plan, split, move or change a task, or when a task is finished.
---

# Write a task

The roadmap, `docs/roadmap.md`, is an index: **Features**, as numbered feature
groups in a fixed order; then the key journeys, the **Decisions** table, and
**Replaced or dropped**. Within a group, the tasks still to do come first,
those tagged `[later]` (set aside, or not yet planned) after them, then the
finished ones, the most recently finished first. "Next up" at the top names
the current group. Each task is one line there, linking to
its own file in `docs/tasks/`, which holds the detail. Tasks are delivered
one at a time, driven from what the user sees, and "make it work, then make
it pretty" (CLAUDE.md).

## In the roadmap

```
- [ ] [FF-104 Mark frames to scan](tasks/FF-104.md): mark frames to be scanned at higher resolution.
```

The ID and title, linked, then a short summary of what it gives the user.
Done tasks drop the summary: `- [x] [FF-104 Mark frames to scan](tasks/FF-104.md)`.

## A task file

`docs/tasks/<ID>.md`, in this shape:

```markdown
# FF-104 Mark frames to scan

**Status:** to do · **Group:** 1. Multi-version frames, finished off · **Was:** U22a

## Why

What it lets me do, and why that matters, in a sentence or two.

## What

What it is, where it lives in the UI, in a short paragraph. *(Split from FF-131.)*

## Acceptance criteria

- [ ] One thing a person can see or do, in the UI's own words ("Mark to
      scan" in the frame view's bar marks the frame; it then reads …).
- [ ] Edge cases and failures: a 409, nothing to show, the limits.

## Not in this task

- What someone might expect that's left out, and the task it's in (FF-131).

## Notes

- Data (roll.json fields), API routes, decisions by number (D50), what it
  needs first, and the tests or journey it adds.
```

- **Status**: `to do` (in a group), `later`, `done` or `dropped`; **Was:**
  names an older code the task was first planned under, if it had one. Later
  tasks have only Why (optional) and What, and "Written when the task is
  planned to be done." under Acceptance criteria. Done tasks have "What
  was built" (see Finishing a task).
- **Acceptance criteria** are written when a task goes into a group, before
  it's built, and the user reviews them then. Each is something a person can
  see or do, or something the API or files on disk do, checkable by a test.
  They map onto the tests: each one has a test that proves it.
- **ID**: a new task takes the next free FF-number, three digits from 100
  (`FF-148`), whatever part of FilmFile it's in. A task keeps its ID once
  given, since decisions and commits cite it; done tasks keep the codes they
  were built under (`U82`, `N3`, `1.3.2`). Split a task into new FF-numbers,
  each with its own file, saying in each "*(Split from FF-104.)*", and
  move the one split to Replaced or dropped. Never reuse an ID. The file
  name is the ID (`FF-104.md`).
- **Groups**: a task sits in the feature group it'll be done in, and stays
  there when done. Reordering work means moving groups or index lines; update "Next up" and each moved
  task file's Group line to match.
- **Later**: a task set aside stays in its feature group, ID unchanged,
  tagged `[later]` in its index line (`- [ ] [later] [FF-130 …](…)`) and
  placed after the tasks to do. When it's picked up, drop the tag, move it
  above the `[later]` tasks and write its acceptance criteria.
- **Commit-sized**: one review's worth. Split when it spans backend and UI
  for a new kind of record and also adds browsing, or when a choice would
  block half of it.
- **User value first**: describe behaviour in the UI's words (labels,
  buttons, headings), not internals. Don't add fields the UI doesn't use yet.
- **Don't build ahead**: a later task says when an abstraction arrives.

## Before writing one

- If fields, options or wording are the user's call, ask with
  AskUserQuestion (with previews for layouts) before planning or building.
- If the request conflicts with `docs/design.md` section 13 or a decision,
  say so rather than silently diverging.

## Decisions

Add a row to the roadmap's table for any choice a later reader would
question: `| D62 | What was decided and why, in a sentence or two. | FF-104 |`.
Number them in order; a superseded decision is struck through and points to
its replacement. Design changes also go in `docs/design.md` (and out of its
open questions).

## Keeping the roadmap consistent

When a task is added, split, moved or renamed, search for its ID
(`grep -rn "FF-104" docs`) and update every reference: the index line, task
files that mention it, the decisions' "Affects" column, the "Key journeys"
table, and `docs/design.md`. Also update `docs/plan-phase-0-1.md` where it
lists fields or routes.

## Finishing a task

- Tick each acceptance criterion in its file as its test passes. One that
  turned out differently is reworded to what was built, with a note why.
- Set **Status:** to `done` with **Built in:** the group's name, and add
  "## What was built": the routes, file names and what's shown, as built.
- Tick its index line (`- [x]`), drop its summary, and move it down within
  its group to just below the tasks still to do, above the ones finished
  earlier. It stays in its group; groups don't move when they're finished.
  If "Next up" named this group and it has nothing left to do, point it at
  the next group that has.
- Record any decision made along the way.
- Run the check skill (Prettier covers the roadmap's index; Markdown
  tables aren't reformatted).
- Commit only when the user asks.
