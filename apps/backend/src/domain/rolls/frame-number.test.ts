import { expect, test } from 'vitest';
import { parseFrameNumber } from './frame-number.ts';

test.each(['1', '00', '-3', '12A', '14-15', 'leader', '123456789'])(
  'accepts %j',
  (value) => {
    expect(parseFrameNumber(value)).toEqual({ ok: true, value });
  },
);

test.each([
  ['nothing', ''],
  ['more than 9 characters', '1234567890'],
])('refuses %s', (_case, value) => {
  expect(parseFrameNumber(value)).toEqual({
    ok: false,
    error: {
      kind: 'validation-failed',
      issues: [
        {
          path: ['number'],
          message: 'must be 1 to 9 characters, like 23 or 12A',
        },
      ],
    },
  });
});
