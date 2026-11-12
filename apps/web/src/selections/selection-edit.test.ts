import { describe, expect, test } from 'vitest';
import {
  choiceOf,
  choicesLeft,
  everyFrame,
  isLimitDate,
  leaveOff,
  matchCount,
  newRule,
  pin,
  putBack,
  ruleChoices,
  searchable,
} from './selection-edit.ts';

const a = { rollId: 'R1', frameId: 'F1' };
const b = { rollId: 'R1', frameId: 'F2' };

describe('frames by hand', () => {
  test('pinning a frame includes it, once', () => {
    expect(pin(pin(everyFrame, a), a).pinned).toEqual([a]);
  });

  test('a frame can’t be both: pinning takes it off the left-off list and the reverse', () => {
    const left = leaveOff(everyFrame, a);
    expect(left.hidden).toEqual([a]);
    expect(pin(left, a)).toMatchObject({ pinned: [a], hidden: [] });
    expect(leaveOff(pin(everyFrame, a), a)).toMatchObject({
      pinned: [],
      hidden: [a],
    });
  });

  test('putting a frame back takes it off both lists and leaves the rest', () => {
    const selection = leaveOff(pin(everyFrame, a), b);
    expect(putBack(selection, b)).toMatchObject({ pinned: [a], hidden: [] });
    expect(putBack(selection, a)).toMatchObject({ pinned: [], hidden: [b] });
  });

  test('keeps only the IDs of a frame that carries more, as the search gives them', () => {
    const found = { ...a, why: 'rules' };
    expect(pin(everyFrame, found).pinned).toEqual([a]);
    expect(leaveOff(everyFrame, found).hidden).toEqual([a]);
  });

  test('keeps the rules', () => {
    const withRule = { ...everyFrame, rules: [newRule('rating')] };
    expect(pin(withRule, a).rules).toEqual(withRule.rules);
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
  [0, 'No frames match'],
  [1, '1 frame matches'],
  [24, '24 frames match'],
])('counts %d as "%s"', (count, text) => {
  expect(matchCount(count)).toBe(text);
});
