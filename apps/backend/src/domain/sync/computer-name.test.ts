import { expect, test } from 'vitest';
import { computerNameFrom, parseComputerName } from './computer-name.ts';

test.each([
  ['Bens-MacBook.local', 'Bens-MacBook'],
  ['studio', 'studio'],
  ['', 'This computer'],
  ['x'.repeat(80), 'x'.repeat(60)],
])('names %s as %s', (hostname, name) => {
  expect(computerNameFrom(hostname)).toBe(name);
});

test('takes a name of 1 to 60 characters, trimmed', () => {
  expect(parseComputerName('  Studio Mac ')).toEqual({
    ok: true,
    value: 'Studio Mac',
  });
});

test.each([[''], ['   '], ['x'.repeat(61)]])('refuses %j', (value) => {
  expect(parseComputerName(value)).toMatchObject({
    ok: false,
    error: {
      issues: [
        { path: ['computerName'], message: 'must be 1 to 60 characters' },
      ],
    },
  });
});
