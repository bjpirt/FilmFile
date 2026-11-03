---
name: screenshot
description: Take a screenshot of FilmFile's UI after setting up data through the browser, to show the user a change or check a layout. Use instead of writing a throwaway Playwright test.
---

# Screenshot

1. Write the steps, as the body of a Playwright test, to a file in the
   scratchpad. `page`, `expect`, `fixtureSets` and the journey helpers
   (`createRoll`, `addCamera`, `addScans`, `renumber`) are in scope. Use
   roll numbers and names no journey uses (e.g. years 2019–2020), since the
   e2e archive is shared.

   ```ts
   await createRoll(page, '2020-001', {
     name: 'Westfjords',
     newCamera: { make: 'Nikon', model: 'FE' },
     newEvent: 'Iceland 2026',
     scans: fixtureSets.headToTail,
   });
   await page.goto('/?group=event');
   ```

2. Run, with the output path in the scratchpad:

   ```sh
   .claude/skills/screenshot/screenshot.sh <scratchpad>/name.png <scratchpad>/steps.ts [--full-page] [--size 1280x1000]
   ```

   It rebuilds the UI, runs the steps against the e2e service and its temp
   archive (never the user's), saves the image and removes its temporary
   test. Use `timeout: 300000`.

3. Read the PNG to look at it, and give the user its full absolute path.

`createRoll` takes `name`, `description`, `year`, `month` (label), `day`,
`time`, `event`, `newEvent`, `camera`, `newCamera`, `newLens`, `filmStock`,
`newFilmStock` and `scans`; see `test/e2e/support/journeys.ts`.
