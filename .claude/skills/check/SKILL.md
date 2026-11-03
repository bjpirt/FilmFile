---
name: check
description: Run FilmFile's checks (format, lint, typecheck, tests with coverage, and optionally the Playwright journeys) with a short summary of failures. Use instead of running pnpm verify or pnpm e2e by hand.
---

# Check

Run `.claude/skills/check/check.sh` from the repository root. It loads the
Node version from `.nvmrc`, formats the code, runs `pnpm verify`, and prints
one line when everything passes or just the failures (file, line, message,
expected and received) when something fails.

| Command | Runs |
| --- | --- |
| `.claude/skills/check/check.sh` | format, then `pnpm verify` |
| `.claude/skills/check/check.sh --e2e` | the above, then the browser journeys |
| `.claude/skills/check/check.sh --e2e-only --times 2` | the journeys twice, to catch flaky ones |

Use `timeout: 600000`. Exit status is 0 only if everything passed.

When it fails:

- Read the summary first; only rerun a single file
  (`pnpm vitest run <path> --coverage.enabled=false`) if the summary isn't
  enough to see why.
- Formatting changes files, so read a file again before editing text in it.
- A journey that fails once and passes on rerun usually means two journeys
  share data in the one e2e archive: give each journey its own roll numbers,
  years and names.
