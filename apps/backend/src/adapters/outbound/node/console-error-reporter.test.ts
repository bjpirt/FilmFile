import { afterEach, expect, test, vi } from 'vitest';
import { ConsoleErrorReporter } from './console-error-reporter.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

test('writes what failed, then the error itself (so its stack), to the error output', () => {
  const written = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const error = new Error('the renderer broke');

  new ConsoleErrorReporter().report("Couldn't build site iceland", error);

  expect(written.mock.calls).toEqual([["Couldn't build site iceland:", error]]);
});
