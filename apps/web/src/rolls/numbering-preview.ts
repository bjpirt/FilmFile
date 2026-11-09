import type { Roll, UnreadableRoll } from '@filmfile/contracts/rolls';
import { compareRollNumbers } from './roll-number.ts';
import {
  firstFreeNumber,
  groupOf,
  occupiedLabels,
  readRollNumber,
  whatIsMissing,
  type RollNumberPattern,
} from './roll-number-pattern.ts';

export interface NumberingSnapshotRoll {
  readonly roll: Roll;
  readonly version: string;
}

export interface NumberingFilters {
  readonly year: string | undefined;
  readonly camera: string | undefined;
  readonly film: string | undefined;
  readonly lens: string | undefined;
}

export interface ProposedRollNumber {
  readonly id: string;
  readonly roll: string;
}

export type NumberingPreview =
  | { readonly ok: true; readonly changes: readonly ProposedRollNumber[] }
  | { readonly ok: false; readonly kind: 'missing-shot-year' }
  // A roll lacks what the pattern uses, e.g. "a shot month" or "an event".
  | {
      readonly ok: false;
      readonly kind: 'missing-pattern-details';
      readonly missing: string;
    };

function matches(roll: Roll, filters: NumberingFilters): boolean {
  return (
    (filters.year === undefined ||
      roll.shot?.startsWith(filters.year) === true) &&
    (filters.camera === undefined || roll.camera === filters.camera) &&
    (filters.film === undefined || roll.film === filters.film) &&
    (filters.lens === undefined || roll.lens === filters.lens)
  );
}

function dateOrder(a: NumberingSnapshotRoll, b: NumberingSnapshotRoll) {
  const byShot = (a.roll.shot ?? '').localeCompare(b.roll.shot ?? '');
  return byShot === 0 ? compareRollNumbers(a.roll.roll, b.roll.roll) : byShot;
}

/**
 * Proposes numbers from the pattern (D88) without changing filed or
 * filtered-out rolls. Rolls are numbered in shot-date order within each group
 * the pattern counts in (its date and event values), after the highest filed
 * number of the group, skipping every number a roll that stays has.
 */
export function numberingPreview(
  snapshot: readonly NumberingSnapshotRoll[],
  unreadable: readonly UnreadableRoll[],
  filters: NumberingFilters,
  pattern: RollNumberPattern,
): NumberingPreview {
  const matching = snapshot.filter(({ roll }) => matches(roll, filters));
  const eligible = matching.filter(({ roll }) => !roll.filed);
  if (eligible.some(({ roll }) => roll.shot === null)) {
    return { ok: false, kind: 'missing-shot-year' };
  }
  for (const { roll } of eligible) {
    const missing = whatIsMissing(pattern, roll);
    if (missing !== undefined) {
      return { ok: false, kind: 'missing-pattern-details', missing };
    }
  }

  const staying = snapshot.filter(
    ({ roll }) =>
      roll.filed || !matching.some((match) => match.roll.id === roll.id),
  );
  const occupied = occupiedLabels(
    staying.map(({ roll }) => roll.roll),
    unreadable.map((entry) => entry.folder),
  );
  const highestFiled = new Map<string, number>();
  for (const { roll } of snapshot) {
    const read = roll.filed ? readRollNumber(pattern, roll.roll) : undefined;
    if (read !== undefined) {
      highestFiled.set(
        read.group,
        Math.max(highestFiled.get(read.group) ?? 0, read.n),
      );
    }
  }

  const changes: ProposedRollNumber[] = [];
  const next = new Map<string, number>();
  for (const { roll } of [...eligible].sort(dateOrder)) {
    const group = groupOf(pattern, roll);
    if (group === undefined) {
      continue;
    }
    const from = next.get(group) ?? (highestFiled.get(group) ?? 0) + 1;
    const proposed = firstFreeNumber(pattern, roll, from, occupied);
    if (proposed === undefined) {
      continue;
    }
    next.set(group, (readRollNumber(pattern, proposed)?.n ?? from) + 1);
    if (roll.roll !== proposed) {
      changes.push({ id: roll.id, roll: proposed });
    }
  }
  return { ok: true, changes };
}
