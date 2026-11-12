import { describe, expect, test } from 'vitest';
import {
  choiceOf,
  choicesLeft,
  everyFrame,
  exclude,
  include,
  isExcluded,
  isLimitDate,
  matchCount,
  newRule,
  ruleChoices,
  searchable,
} from './selection-edit.ts';

const a = { rollId: 'R1', frameId: 'F1' };
const b = { rollId: 'R1', frameId: 'F2' };

describe('frames excluded by hand', () => {
  test('excluding a frame adds it once', () => {
    const twice = exclude(exclude(everyFrame, a), a);
    expect(twice.excluded).toEqual([a]);
    expect(isExcluded(twice, a)).toBe(true);
    expect(isExcluded(twice, b)).toBe(false);
  });

  test('including it again takes it off and leaves the rest', () => {
    const both = exclude(exclude(everyFrame, a), b);
    expect(include(both, a).excluded).toEqual([b]);
  });

  test('keeps only the IDs of a frame that carries more, as the search gives them', () => {
    const found = { ...a, excluded: false };
    expect(exclude(everyFrame, found).excluded).toEqual([a]);
  });

  test('keeps the rules', () => {
    const withRule = { ...everyFrame, rules: [newRule('rating')] };
    expect(exclude(withRule, a).rules).toEqual(withRule.rules);
  });
});

describe('rules', () => {
  test('every kind of rule can be made and is told apart by its entry in the menu', () => {
    expect(ruleChoices.map((choice) => choiceOf(newRule(choice)))).toEqual(
      ruleChoices,
    );
  });

  test('offers each kind only until it is added', () => {
    const rules = [newRule('rating'), newRule('has-final')];
    const left = choicesLeft(rules);
    expect(left).not.toContain('rating');
    expect(left).not.toContain('has-final');
    expect(left).toContain('has-raw-scan');
    expect(choicesLeft([])).toEqual(ruleChoices);
  });

  test.each(['2026', '2026-09', '2026-09-14', '2024-02-29'])(
    'accepts the date %s',
    (date) => {
      expect(isLimitDate(date)).toBe(true);
    },
  );

  test.each(['', '26', '2026-13', '2026-02-30', '2026-09-14T10:00', 'soon'])(
    'refuses the date %j',
    (date) => {
      expect(isLimitDate(date)).toBe(false);
    },
  );

  test('leaves out a date rule waiting for a date, and keeps the rest', () => {
    const selection = {
      ...everyFrame,
      rules: [
        newRule('rating'),
        newRule('shot-after'),
        { kind: 'shot-before' as const, date: '2026-09' },
      ],
    };
    expect(searchable(selection).rules).toEqual([
      newRule('rating'),
      { kind: 'shot-before', date: '2026-09' },
    ]);
  });
});

test.each([
  [0, 0, 'No frames match'],
  [1, 0, '1 frame matches'],
  [24, 0, '24 frames match'],
  [22, 2, '22 frames match, 2 excluded'],
  [1, 1, '1 frame matches, 1 excluded'],
  [0, 3, 'No frames match, 3 excluded'],
])('counts %d with %d excluded as "%s"', (count, excluded, text) => {
  expect(matchCount(count, excluded)).toBe(text);
});
