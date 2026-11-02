import { describe, expect, test } from 'vitest';
import { safePath } from './safe-path.ts';

const root = '/archive';

describe('safePath', () => {
  test.each([
    [['roll.json'], '/archive/roll.json'],
    [
      ['rolls', '2026', '2026-014', 'roll.json'],
      '/archive/rolls/2026/2026-014/roll.json',
    ],
    [
      ['frames', 'S9WDVXNP', '9PMYF63D', '12340014.jpg'],
      '/archive/frames/S9WDVXNP/9PMYF63D/12340014.jpg',
    ],
    [['..hidden-but-fine'], '/archive/..hidden-but-fine'],
    [[], '/archive'],
  ])('joins %j under the root', (names, expected) => {
    expect(safePath(root, ...names)).toBe(expected);
  });

  test.each([
    ['a parent folder', ['..']],
    ['a parent folder further in', ['rolls', '..', '..', 'etc']],
    ['the current folder', ['.']],
    ['an absolute path', ['/etc/passwd']],
    ['a name with a separator', ['rolls/../../etc']],
    ['a name with a Windows separator', ['..\\..\\etc']],
    ['a null byte', ['roll.json\0.jpg']],
    ['an empty name', ['']],
  ])('refuses %s', (_case, names) => {
    expect(() => safePath(root, ...names)).toThrow('unsafe path');
  });

  test('refuses a relative root', () => {
    expect(() => safePath('archive', 'roll.json')).toThrow('unsafe path');
  });
});
