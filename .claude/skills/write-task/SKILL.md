---
name: write-task
description: How to add, split, reorder, tick off and rewrite tasks and decisions in FilmFile's roadmap (docs/roadmap.md). Use whenever the user asks to plan, split, move or change a task, or when a task is finished.
---

# Write a task

The roadmap is `docs/roadmap.md`: **To do**, as numbered feature groups in
the order they'll be done (plus "Not placed yet"); then the key journeys,
**Parked**, the **Decisions** table, and **Done** (what's been built, by
stage, with what was replaced or dropped). "Next up" at the top names the
current group. Tasks are delivered one at a time, driven from what the user
sees, and "make it work, then make it pretty" (CLAUDE.md).

## A task

```
- [ ] **U12c An event's frames.** One paragraph: what the user can do and
  see, where (page, control, address), what's kept and how, edge cases, and
  which journey it adds or extends. Decisions by number (D33).
```

- **ID**: tasks keep the ID they were first planned with (`U14`, `1b.8`),
  since decisions cite them. A new task takes the next free `U` number
  (`U23` onwards). Split a task by suffixing letters (`U9a`, `U9b`). Never
  reuse an ID for something else.
- **Groups**: a task sits in the feature group it'll be done in. Reordering
  work means moving groups or tasks; update "Next up" to match.
- **Parked**: a task set aside moves, ID unchanged, to Parked; when picked
  up it moves into the feature group it'll be done in.
- **Done**: a finished task moves, ticked, from To do into Done, under the
  feature group's own heading there (add one if it's the group's first).
- **Commit-sized**: one review's worth. Split when it spans backend and UI
  for a new kind of record and also adds browsing (record it first, find by
  it second), or when a choice would block half of it.
- **User value first**: describe behaviour in the UI's words (labels,
  buttons, headings), not internals. Don't add fields the UI doesn't use yet.
- **Don't build ahead**: a later task says when an abstraction arrives.

## Before writing one

- If fields, options or wording are the user's call, ask with
  AskUserQuestion (with previews for layouts) before planning or building.
- If the request conflicts with `docs/design.md` section 13 or a decision,
  say so rather than silently diverging.

## Decisions

Add a row to the table for any choice a later reader would question:
`| D34 | What was decided and why, in a sentence or two. | U12c |`. Number
them in order; a superseded decision is struck through and points to its
replacement. Design changes also go in `docs/design.md` (and out of its open
questions).

## Keeping the roadmap consistent

When a task is added, split, moved or renamed, search the file for its ID
(`grep -n "U12c" docs/roadmap.md`) and update every reference: the
decisions' "Affects" column, the "Key journeys" table, and notes in other
tasks that point at it. Also update
`docs/plan-phase-0-1.md` where it lists fields or routes.

## Finishing a task

- Tick it (`- [x]`), rewrite its text to say what was actually built
  (routes, file names, what's shown), and move it into Done, so the
  roadmap stays true. When its group is finished, point "Next up" at the
  next group.
- Record any decision made along the way.
- Run `pnpm prettier --check docs` (or the check skill).
- Commit only when the user asks; plan changes and code can go in separate
  commits if the user wants them apart.
