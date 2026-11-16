import { describe, expect, test } from 'vitest';
import { isRollId, type RollId } from '../shared/ids.ts';
import { planRollRenumbering } from './plan-roll-renumbering.ts';
import { isRollNumber, type RollNumber } from './roll-number.ts';
import type { Roll } from './roll.ts';

function checked<T extends string>(
  value: string,
  isValid: (value: string) => value is T,
): T {
  if (!isValid(value)) {
    throw new Error(`bad test data: ${value}`);
  }
  return value;
}

const idOf = (roll: Roll): RollId => roll.id;
const number = (value: string): RollNumber => checked(value, isRollNumber);
const aRoll = (id: string, roll: string): Roll => ({
  id: checked(id, isRollId),
  roll: number(roll),
  filed: false,
  name: null,
  notes: null,
  shot: null,
  event: null,
  camera: null,
  film: null,
  lens: null,
  frames: [],
});
const a = aRoll('00000000000000000000000001', '2026-001');
const b = aRoll('00000000000000000000000002', '2026-002');
const filed: Roll = {
  ...aRoll('00000000000000000000000003', '2026-003'),
  filed: true,
};
const stranger = aRoll('00000000000000000000000009', '2026-009');
const bad = { folder: '2026-050', problem: 'unreadable' };

const listed = (...rolls: Roll[]) =>
  rolls.map((roll) => ({ roll, version: `v-${roll.id}` }));
const snapshot = (...rolls: Roll[]) =>
  rolls.map((roll) => ({ id: idOf(roll), version: `v-${roll.id}` }));

function plan(
  overrides: Partial<Parameters<typeof planRollRenumbering>[0]> = {},
) {
  return planRollRenumbering({
    current: listed(a, b, filed),
    currentUnreadable: [],
    expected: snapshot(a, b, filed),
    expectedUnreadable: [],
    changes: [],
    ...overrides,
  });
}

const refusals: readonly [
  string,
  Partial<Parameters<typeof planRollRenumbering>[0]>,
  unknown,
][] = [
  [
    'a snapshot naming a roll twice',
    { expected: snapshot(a, a, b, filed) },
    {
      kind: 'validation-failed',
      issues: [{ path: ['snapshot'], message: 'contains a duplicate roll' }],
    },
  ],
  [
    'a roll missing from the archive',
    { current: listed(a, filed) },
    { kind: 'concurrency-conflict', entity: 'roll', id: idOf(b) },
  ],
  [
    'a roll whose version changed',
    { expected: [{ id: idOf(a), version: 'old' }, ...snapshot(b, filed)] },
    { kind: 'concurrency-conflict', entity: 'roll', id: idOf(a) },
  ],
  [
    'a roll added since the snapshot',
    { current: listed(a, b, filed, stranger) },
    { kind: 'concurrency-conflict', entity: 'roll', id: idOf(stranger) },
  ],
  [
    'unreadable rolls that differ from the snapshot',
    { currentUnreadable: [bad] },
    { kind: 'concurrency-conflict', entity: 'roll', id: 'unreadable' },
  ],
  [
    'changes naming a roll twice',
    {
      changes: [
        { id: idOf(a), roll: number('x-1') },
        { id: idOf(a), roll: number('x-2') },
      ],
    },
    {
      kind: 'validation-failed',
      issues: [{ path: ['changes'], message: 'contains a duplicate roll' }],
    },
  ],
  [
    'a change to an unknown roll',
    { changes: [{ id: idOf(stranger), roll: number('x-1') }] },
    {
      kind: 'validation-failed',
      issues: [{ path: ['changes'], message: 'includes an unknown roll' }],
    },
  ],
  [
    'a new number for a filed roll',
    { changes: [{ id: idOf(filed), roll: number('x-1') }] },
    {
      kind: 'validation-failed',
      issues: [
        { path: ['roll'], message: "A filed roll's number can't be changed." },
      ],
    },
  ],
  [
    'numbers that are not unique afterwards',
    { changes: [{ id: idOf(a), roll: number('2026-002') }] },
    {
      kind: 'validation-failed',
      issues: [{ path: ['changes'], message: 'roll numbers must be unique' }],
    },
  ],
  [
    'a number held by an unreadable folder',
    {
      currentUnreadable: [bad],
      expectedUnreadable: [bad],
      changes: [{ id: idOf(a), roll: number('2026-050') }],
    },
    {
      kind: 'validation-failed',
      issues: [
        {
          path: ['changes'],
          message: 'a roll number is used by an unreadable roll folder',
        },
      ],
    },
  ],
];

describe('planRollRenumbering', () => {
  test.each(refusals)('refuses %s', (_name, overrides, error) => {
    expect(plan(overrides)).toEqual({ ok: false, error });
  });

  test('checks the snapshot before the changes', () => {
    const result = plan({
      current: listed(a, filed),
      changes: [{ id: idOf(a), roll: number('2026-003') }],
    });
    expect(result).toMatchObject({ error: { kind: 'concurrency-conflict' } });
  });

  test('gives only the changes whose number really differs, in the archive order', () => {
    const result = plan({
      changes: [
        { id: idOf(b), roll: number('2026-001') },
        { id: idOf(filed), roll: number('2026-003') },
        { id: idOf(a), roll: number('2026-002') },
      ],
    });
    expect(result).toEqual({
      ok: true,
      value: [
        { id: idOf(a), roll: '2026-002' },
        { id: idOf(b), roll: '2026-001' },
      ],
    });
  });

  test('accepts unreadable rolls that match the snapshot, in any order', () => {
    const other = { folder: '2026-060', problem: 'unreadable' };
    const result = plan({
      currentUnreadable: [bad, other],
      expectedUnreadable: [other, bad],
      changes: [{ id: idOf(a), roll: number('2026-010') }],
    });
    expect(result).toEqual({
      ok: true,
      value: [{ id: idOf(a), roll: '2026-010' }],
    });
  });
});
