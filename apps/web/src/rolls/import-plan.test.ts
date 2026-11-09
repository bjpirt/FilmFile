import { describe, expect, test } from 'vitest';
import type { ImportFolder } from './import-folders.ts';
import { planned, rowsFor } from './import-plan.ts';
import { patternOf } from './roll-number-pattern.ts';

function folder(name: string, scans = 2): ImportFolder {
  return {
    name,
    scans: Array.from(
      { length: scans },
      (_, i) => new File(['x'], `${String(i)}.jpg`),
    ),
  };
}

describe('rowsFor', () => {
  test('dates each folder from its name, else this year', () => {
    const rows = rowsFor(
      [folder('2024-08-12 Iceland'), folder('roll A')],
      '2026',
    );

    expect(rows.map((row) => row.shot)).toEqual([
      { year: '2024', month: '08', day: '12', time: '' },
      { year: '2026', month: '', day: '', time: '' },
    ]);
    expect(rows.every((row) => row.included)).toBe(true);
  });
});

describe('planned', () => {
  const rows = rowsFor(
    [folder('Iceland 2019'), folder('roll A'), folder('roll B')],
    '2026',
  );

  test('numbers the rows by their dates from the pattern, after what is taken', () => {
    const plan = planned(rows, patternOf('{year}-{n:3}'), [
      '2026-005',
      '2019-001',
    ]);

    expect(plan.map((row) => row.number)).toEqual([
      '2019-002',
      '2026-006',
      '2026-007',
    ]);
    expect(plan.map((row) => row.shotDate)).toEqual(['2019', '2026', '2026']);
  });

  test('leaves out rows not ticked, and numbers the rest as if they were not there', () => {
    const plan = planned(
      rows.map((row, i) => (i === 1 ? { ...row, included: false } : row)),
      patternOf('{year}-{n:3}'),
      [],
    );

    expect(plan.map((row) => row.number)).toEqual([
      '2019-001',
      undefined,
      '2026-001',
    ]);
  });

  test('puts MM, DD or event in for what is missing, counting up past those given', () => {
    const plan = planned(rows, patternOf('{event}-{year}{month}{day}-{n:2}'), [
      'event-2026MMDD-01',
    ]);

    expect(plan.map((row) => row.number)).toEqual([
      'event-2019MMDD-01',
      'event-2026MMDD-02',
      'event-2026MMDD-03',
    ]);
  });

  test('has no number for a date that is not right', () => {
    const [first] = rows;
    const plan = planned(
      first === undefined
        ? []
        : [{ ...first, shot: { ...first.shot, year: '26' } }],
      patternOf('{year}-{n:3}'),
      [],
    );

    expect(plan[0]).toMatchObject({ number: undefined, shotDate: undefined });
  });

  test('has no number for a day the month does not have', () => {
    const [first] = rows;
    const plan = planned(
      first === undefined
        ? []
        : [
            {
              ...first,
              shot: { year: '2023', month: '02', day: '30', time: '' },
            },
          ],
      patternOf('{year}-{n:3}'),
      [],
    );

    expect(plan[0]?.number).toBeUndefined();
  });
});
