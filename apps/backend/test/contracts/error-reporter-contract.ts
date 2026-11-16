import { describe, expect, test } from 'vitest';
import type { ErrorReporter } from '../../src/application/ports/error-reporter.ts';

/** What every ErrorReporter must do, run against each adapter. */
export function errorReporterContract(
  name: string,
  make: () => ErrorReporter,
): void {
  describe(`${name} meets the ErrorReporter contract`, () => {
    // What's caught can be anything, since JavaScript lets anything be thrown.
    test.each([
      ['an Error', new Error('the renderer broke')],
      ['a string', 'the renderer broke'],
      ['undefined', undefined],
      ['an object', { code: 'EIO' }],
    ])('takes %s as the error without throwing', (_kind, error) => {
      const reporter = make();

      expect(() => {
        reporter.report("Couldn't build site iceland", error);
      }).not.toThrow();
    });
  });
}
