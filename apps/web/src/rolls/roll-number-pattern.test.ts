import { describe, expect, test } from 'vitest';
import {
  defaultRollNumberPattern,
  exampleRollNumber,
  firstFreeNumber,
  parseRollNumberPattern,
  patternOf,
  readRollNumber,
  renderRollNumber,
  suggestRollNumber,
  whatIsMissing,
  type RollFacts,
} from './roll-number-pattern.ts';

function pattern(source: string) {
  return patternOf(source);
}

const september: RollFacts = { shot: '2026-09-14', event: 'iceland' };

describe('parseRollNumberPattern', () => {
  test.each([
    ['{year}-{n:3}', 'year', false],
    ['{n:4}', 'year', false],
    ['BP-{year}-{n:2}', 'year', false],
    ['{year}{month}-{n:3}', 'month', false],
    ['{day}/{n:1}', 'day', false],
    ['{event}-{n:2}', 'year', true],
  ] as const)('accepts %s', (source, shot, event) => {
    const parsed = parseRollNumberPattern(source);

    expect(
      parsed.ok && { shot: parsed.pattern.shot, event: parsed.pattern.event },
    ).toEqual({ shot, event });
  });

  test.each([
    ['', 'needs a sequence number like {n:3}'],
    ['{year}', 'needs a sequence number like {n:3}'],
    ['{n:3}{n:2}', 'can have only one sequence number like {n:3}'],
    ['{n}', "has {n}, which isn't one of"],
    ['{n:10}', "has {n:10}, which isn't one of"],
    ['{film}-{n:3}', "has {film}, which isn't one of"],
    ['{year-{n:3}', 'has a { with no } after it'],
    ['{year', 'has a { with no } after it'],
    ['year}-{n:3}', 'has a } with no { before it'],
    [`${'x'.repeat(97)}{n:4}`, 'could make roll numbers longer than 100'],
  ])('refuses %j', (source, message) => {
    const parsed = parseRollNumberPattern(source);

    expect(!parsed.ok && parsed.message).toContain(message);
  });
});

describe('renderRollNumber and exampleRollNumber', () => {
  test.each([
    [defaultRollNumberPattern, '2026-014'],
    ['{n:4}', '0014'],
    ['BP-{year}-{n:2}', 'BP-2026-14'],
    ['{year}{month}-{n:3}', '202609-014'],
    ['{year}-{month}-{day}/{n:1}', '2026-09-14/14'],
    ['{event}-{n:2}', 'iceland-14'],
  ])('%s renders %s', (source, expected) => {
    expect(renderRollNumber(pattern(source), september, 14)).toBe(expected);
  });

  test('has no number for a roll without what the pattern uses', () => {
    expect(
      renderRollNumber(
        pattern('{year}{month}-{n:3}'),
        { shot: '2026', event: null },
        1,
      ),
    ).toBeUndefined();
    expect(
      whatIsMissing(pattern('{year}{month}-{n:3}'), {
        shot: '2026',
        event: null,
      }),
    ).toBe('a shot month');
    expect(whatIsMissing(pattern('{event}-{n:3}'), september)).toBeUndefined();
    expect(
      whatIsMissing(pattern('{event}-{n:3}'), { shot: '2026', event: null }),
    ).toBe('an event');
  });

  test('lets numbers grow past their width', () => {
    expect(renderRollNumber(pattern('{year}-{n:3}'), september, 1000)).toBe(
      '2026-1000',
    );
  });

  test('gives an example for the settings page', () => {
    expect(exampleRollNumber(pattern('{event}-{year}{month}-{n:3}'))).toBe(
      'iceland-2026-202609-014',
    );
  });
});

describe('readRollNumber', () => {
  test('gives a number its group and sequence value, whatever its width', () => {
    expect(readRollNumber(pattern('{year}-{n:3}'), '2026-014')).toEqual({
      group: '2026',
      n: 14,
    });
    expect(readRollNumber(pattern('{year}-{n:3}'), '2026-1000')).toEqual({
      group: '2026',
      n: 1000,
    });
    expect(readRollNumber(pattern('{event}-{n:2}'), 'Iceland-07')).toEqual({
      group: 'iceland',
      n: 7,
    });
  });

  test('does not read other forms, nor treat fixed text as a pattern', () => {
    expect(
      readRollNumber(pattern('{year}-{n:3}'), 'BP-2026-014'),
    ).toBeUndefined();
    expect(readRollNumber(pattern('A.{n:2}'), 'AB01')).toBeUndefined();
  });
});

describe('suggestRollNumber', () => {
  test('starts at the first number of a year', () => {
    expect(suggestRollNumber(pattern('{year}-{n:3}'), september, [])).toBe(
      '2026-001',
    );
  });

  test('follows the highest of its year, never reusing a gap', () => {
    expect(
      suggestRollNumber(pattern('{year}-{n:3}'), september, [
        '2026-001',
        '2026-020',
        '2025-300',
        'misc',
      ]),
    ).toBe('2026-021');
  });

  test('keeps growing past 999', () => {
    expect(
      suggestRollNumber(pattern('{year}-{n:3}'), september, ['2026-999']),
    ).toBe('2026-1000');
  });

  test('counts each month, or event, on its own', () => {
    const monthly = pattern('{year}{month}-{n:2}');
    expect(
      suggestRollNumber(monthly, september, ['202609-04', '202608-09']),
    ).toBe('202609-05');
    expect(
      suggestRollNumber(monthly, { shot: '2026-10', event: null }, [
        '202609-04',
      ]),
    ).toBe('202610-01');
    expect(
      suggestRollNumber(
        pattern('{event}-{n:2}'),
        { shot: '2026', event: 'japan' },
        ['iceland-04'],
      ),
    ).toBe('japan-01');
  });

  test('has one counter across the archive without date tokens', () => {
    expect(
      suggestRollNumber(pattern('BP{n:2}'), september, ['BP07', '2026-030']),
    ).toBe('BP08');
  });

  test('ignores labels in another form when counting, but never gives out one of them', () => {
    expect(suggestRollNumber(pattern('{n:2}'), september, ['Iceland'])).toBe(
      '01',
    );
    expect(firstFreeNumber(pattern('{n:2}'), september, 1, ['01', '02'])).toBe(
      '03',
    );
  });

  test('skips numbers occupied by a roll folder that cannot be read, however it was spelled', () => {
    expect(
      firstFreeNumber(pattern('{year}-{n:3}'), september, 1, [
        '2026-1',
        '2026-002',
      ]),
    ).toBe('2026-003');
  });

  test('has none for a roll lacking what the pattern uses', () => {
    expect(
      suggestRollNumber(
        pattern('{year}{month}-{n:3}'),
        { shot: '2026', event: null },
        [],
      ),
    ).toBeUndefined();
  });
});
