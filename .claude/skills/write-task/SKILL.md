---
name: write-task
description: How to add, split, reorder, tick off and rewrite tasks and decisions in FilmFile's plan (docs/tasks-phase-0-1.md). Use whenever the user asks to plan, split, move or change a task, or when a task is finished.
---

# Write a task

The plan is `docs/tasks-phase-0-1.md`: a Decisions table, then milestones
(S, H, N, U, P) of tasks. Tasks are delivered one at a time, driven from
what the user sees, and "make it work, then make it pretty" (CLAUDE.md).

## A task

```
- [ ] **U12c An event's frames.** One paragraph: what the user can do and
  see, where (page, control, address), what's kept and how, edge cases, and
  which journey it adds or extends. Decisions by number (D33).
```

- **ID**: milestone letter and number. Split a task by suffixing letters
  (`U9a`, `U9b`); a task moved to later gets the next free number
  (sub-events became `U19`). Never reuse an ID for something else.
- **Parked**: a task set aside moves, ID unchanged, to the Parked section
  after the U milestone; when picked up it moves back to its milestone.
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

## Keeping the plan consistent

When a task is added, split, moved or renamed, search the file for its ID
(`grep -n "U12c" docs/tasks-phase-0-1.md`) and update every reference: the
decisions' "Affects" column, the journeys table under "Browser tests for key
journeys", and the P-milestone items that point at U tasks. Also update
`docs/plan-phase-0-1.md` where it lists fields or routes.

## Finishing a task

- Tick it (`- [x]`) and rewrite its text to say what was actually built
  (routes, file names, what's shown), so the plan stays true.
- Record any decision made along the way.
- Run `pnpm prettier --check docs` (or the check skill).
- Commit only when the user asks; plan changes and code can go in separate
  commits if the user wants them apart.
