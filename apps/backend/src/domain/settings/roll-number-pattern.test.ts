import { describe, expect, test } from 'vitest';
import {
  defaultRollNumberPattern,
  parseRollNumberPattern,
  shotHasPrecision,
} from './roll-number-pattern.ts';

function messageFor(pattern: string): string | undefined {
  const parsed = parseRollNumberPattern(pattern);
  return parsed.ok ? undefined : parsed.error.issues[0]?.message;
}

describe('parseRollNumberPattern', () => {
  test.each([
    [defaultRollNumberPattern, { shot: 'year', event: false }],
    ['{n:4}', { shot: 'year', event: false }],
    ['BP-{year}-{n:2}', { shot: 'year', event: false }],
    ['{year}{month}-{n:3}', { shot: 'month', event: false }],
    ['{year}-{month}-{day}-{n:1}', { shot: 'day', event: false }],
    ['{day}/{n:3}', { shot: 'day', event: false }],
    ['{event}-{n:2}', { shot: 'year', event: true }],
  ] as const)('accepts %s, needing %j', (pattern, needs) => {
    expect(parseRollNumberPattern(pattern)).toEqual({ ok: true, value: needs });
  });

  test.each([
    ['', 'needs a sequence number like {n:3}'],
    ['{year}', 'needs a sequence number like {n:3}'],
    ['{n:3}{n:2}', 'can have only one sequence number like {n:3}'],
    ['{n}', "has {n}, which isn't one of"],
    ['{n:0}', "has {n:0}, which isn't one of"],
    ['{n:10}', "has {n:10}, which isn't one of"],
    ['{Year}-{n:3}', "has {Year}, which isn't one of"],
    ['{film}-{n:3}', "has {film}, which isn't one of"],
    ['{year-{n:3}', 'has a { with no } after it'],
    ['{year', 'has a { with no } after it'],
    ['year}-{n:3}', 'has a } with no { before it'],
  ])('refuses %j', (pattern, message) => {
    expect(messageFor(pattern)).toContain(message);
  });

  test('refuses a pattern that could make a roll number over 100 characters', () => {
    expect(messageFor(`${'x'.repeat(97)}{n:4}`)).toBe(
      'could make roll numbers longer than 100 characters',
    );
    expect(parseRollNumberPattern(`${'x'.repeat(96)}{n:4}`).ok).toBe(true);
    expect(messageFor('{event}-{event}-{n:3}')).toContain('longer than 100');
  });
});

describe('shotHasPrecision', () => {
  test.each([
    ['2026', 'year', true],
    [null, 'year', true],
    ['2026', 'month', false],
    ['2026-09', 'month', true],
    ['2026-09', 'day', false],
    ['2026-09-14', 'day', true],
    ['2026-09-14T15:30', 'day', true],
    [null, 'month', false],
  ] as const)('%s needing %s is %s', (shot, needed, expected) => {
    expect(shotHasPrecision(shot, needed)).toBe(expected);
  });
});
