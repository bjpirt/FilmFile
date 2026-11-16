import { expect, test } from 'vitest';
import { InMemoryErrorReporter } from './in-memory-error-reporter.ts';

test('keeps each report, in order, with what failed and the error', () => {
  const reporter = new InMemoryErrorReporter();
  const first = new Error('the renderer broke');

  reporter.report("Couldn't build site iceland", first);
  reporter.report("Couldn't make frame 1 of roll 2026-014", 'a string');

  expect(reporter.reported).toEqual([
    { what: "Couldn't build site iceland", error: first },
    { what: "Couldn't make frame 1 of roll 2026-014", error: 'a string' },
  ]);
});

test('has nothing until something is reported', () => {
  expect(new InMemoryErrorReporter().reported).toEqual([]);
});
