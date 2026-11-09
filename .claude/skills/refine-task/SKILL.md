---
name: refine-task
description: Refine one of FilmFile's tasks (docs/tasks/<ID>.md) before it's built, by asking the user about every design decision in it, then rewriting the task file with the answers. Use when the user asks to refine, review, firm up or question a task or ticket, e.g. "refine FF-105".
---

# Refine a task

The task to refine is the argument (an ID such as `FF-105`). With none, ask
which, suggesting the first unfinished task under "Next up" in
`docs/roadmap.md`. Task files and the roadmap follow the `write-task`
skill; this skill only sharpens one task, it doesn't add, split or move
any (if refining shows a task should be split or moved, say so and use
`write-task` once the user agrees).

## 1. Read before asking

Read enough to ask good questions, and never ask what these already settle:

- The task file, and the tasks it names (what it needs, what's left out).
- Its index line and group in `docs/roadmap.md`, and every decision it
  cites (D-numbers), plus any others on the same subject.
- The parts of `docs/design.md` it touches, and CLAUDE.md's invariants.
- The code it will change, briefly: the page, route or adapter it extends,
  and how similar things already work (labels, menus, icons, messages), so
  questions offer options consistent with what's there.

## 2. Find every decision

List every design decision the task makes or leaves open. Look for:

- **What the user sees:** labels and wording, where a control goes (bar,
  menu, Actions, Settings), icons, what's shown when there's nothing, counts
  and messages, how it looks on a phone, keyboard use, screen-reader names.
- **Behaviour:** defaults, ordering, what happens to existing data, undo or
  confirmation, what's automatic and what's by hand, how it interacts with
  bulk edit, renumbering, deleting, the desktop app.
- **Failures and edges:** a 409, a missing file or folder, nothing chosen,
  limits, very large rolls, odd frame numbers (`00`, `12A`, `14-15`).
- **Data and API:** field names and where they're kept (roll.json, an event,
  per-computer settings), routes and their shapes, migration of old files.
- **Scope:** what's in, what's left for another task, what it depends on.
- **Testing:** which journey it adds or extends.

Include decisions the task already states (the user may not have chosen
them; earlier planning often did) as well as ones it's silent on.

## 3. Ask

Ask with AskUserQuestion, up to four questions a call, grouped by theme
(what you see first, then behaviour, then edges, then data), and keep
asking until every decision is covered. For each question:

- Make it stand on its own: name the task and the thing in question, and
  say briefly what you found that bears on it.
- Give two to four real options. Put the one you'd recommend first, marked
  "(Recommended)", with why in its description. When the task already
  states a choice, include it as an option, saying it's the current one.
- Use previews for layouts and wording (an ASCII sketch of the bar, the
  menu, the message), so options can be compared side by side.
- Don't ask about what CLAUDE.md's invariants or a decision already fix;
  mention those in the summary instead. If an answer would break one, say
  so and ask again.

Before the first question, tell the user how many decisions you found and
roughly how many rounds of questions that is. If the user says to take the
recommendations for the rest, do so and say which you took.

When every decision is answered, ask the user whether there's anything else
they'd like to change or add to the task before you update it. Ask about
any new decisions their answer raises, as above, and ask again until they
say there's nothing more.

## 4. Update the task

Rewrite `docs/tasks/<ID>.md` with the answers, in the `write-task` shape:

- **Why** and **What**: sharpened to match.
- **Acceptance criteria**: one per behaviour, each something a person can
  see or do (in the UI's exact words) or something the API or files do,
  checkable by a test. Cover the edges and failures answered.
- **Not in this task**: everything decided to leave out, with the task it's
  in, or a new `[later]` line in the group it belongs to if it has none (ask first).
- **Notes**: data and API shapes, decisions by number, what it needs first,
  the journey it adds or extends.

Then keep the rest true:

- The task's summary in `docs/roadmap.md`, if what it gives the user changed.
- A decision row in the roadmap's table for any answer a later reader would
  question, and `docs/design.md` for any design change (the `write-task`
  skill's rules).
- Other tasks whose scope moved because of an answer (their Not in this
  task and criteria).

Run `pnpm prettier --check docs .claude` and fix anything it reports.

## 5. Report

Summarise for the user: the decisions made (one line each, saying which were
your recommendation and which they changed), anything fixed by an invariant
or decision rather than asked, other files changed, and anything still open.
Don't commit unless asked.
