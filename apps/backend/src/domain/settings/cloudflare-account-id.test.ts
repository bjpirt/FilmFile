import { expect, test } from 'vitest';
import { parseCloudflareAccountId } from './cloudflare-account-id.ts';

test('accepts 32 hexadecimal characters, in either case', () => {
  expect(parseCloudflareAccountId('0123456789abcdefABCDEF0123456789')).toEqual({
    ok: true,
    value: '0123456789abcdefABCDEF0123456789',
  });
});

test.each([
  ['too short', 'abc'],
  ['not hexadecimal', 'g123456789abcdef0123456789abcdef'],
  ['with spaces around it', ' 0123456789abcdef0123456789abcdef'],
  ['empty', ''],
])('refuses an ID that is %s', (_name, value) => {
  expect(parseCloudflareAccountId(value)).toEqual({
    ok: false,
    error: {
      kind: 'validation-failed',
      issues: [
        {
          path: ['cloudflareAccountId'],
          message: 'must be 32 hexadecimal characters',
        },
      ],
    },
  });
});
