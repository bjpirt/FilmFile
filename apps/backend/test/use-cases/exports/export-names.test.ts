import { describe, expect, test } from 'vitest';
import {
  FilePaths,
  fileNameOf,
  safeName,
  unknownPlaceholders,
} from '../../../src/application/use-cases/exports/export-names.ts';

const parts = {
  roll: '2026-014',
  frame: '12A',
  title: 'Black sand',
  year: '2026',
  original: '12340014',
};

describe('fileNameOf', () => {
  test.each([
    ['{roll}-{frame}', '2026-014-12A'],
    ['{year} {title} ({original})', '2026 Black sand (12340014)'],
    ['{frame}', '12A'],
    ['plain', 'plain'],
  ])('fills in %s', (pattern, name) => {
    expect(fileNameOf(pattern, parts)).toBe(name);
  });

  test('leaves no trailing dash when the title is missing', () => {
    expect(fileNameOf('{roll}-{title}', { ...parts, title: '' })).toBe(
      '2026-014',
    );
  });

  test('falls back to the roll and frame when nothing is left', () => {
    expect(fileNameOf('{title}', { ...parts, title: '' })).toBe('2026-014-12A');
  });
});

describe('safeName', () => {
  test.each([
    ['a/b\\c:d', 'a-b-c-d'],
    ['  .hidden  ', 'hidden'],
    ['what?*"<>|', 'what'],
    ['many   spaces', 'many spaces'],
    ['Café ☕', 'Café ☕'],
  ])('makes %j into %j', (text, name) => {
    expect(safeName(text)).toBe(name);
  });
});

test('knows a {placeholder} that is not one', () => {
  expect(unknownPlaceholders('{roll}-{rol}-{x}')).toEqual(['rol', 'x']);
  expect(unknownPlaceholders('{roll}-{frame}')).toEqual([]);
});

describe('FilePaths', () => {
  test.each([
    ['flat', '2026-014-12A.jpg'],
    ['roll-folder', '2026-014/2026-014-12A.jpg'],
    ['year-roll', '2026/2026-014/2026-014-12A.jpg'],
  ] as const)('lays a %s file out', (layout, path) => {
    expect(new FilePaths(layout, '{roll}-{frame}').next(parts)).toBe(path);
  });

  test('numbers names that would be the same, whatever their case', () => {
    const paths = new FilePaths('flat', '{title}');

    expect([
      paths.next(parts),
      paths.next(parts),
      paths.next({ ...parts, title: 'BLACK SAND' }),
    ]).toEqual(['Black sand.jpg', 'Black sand-2.jpg', 'BLACK SAND-3.jpg']);
  });

  test('numbers within a folder only', () => {
    const paths = new FilePaths('roll-folder', '{frame}');

    expect([
      paths.next(parts),
      paths.next({ ...parts, roll: '2026-015' }),
    ]).toEqual(['2026-014/12A.jpg', '2026-015/12A.jpg']);
  });
});
