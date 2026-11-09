import type { Roll, UnreadableRoll } from '@filmfile/contracts/rolls';
import { compareRollNumbers, sameRollNumber } from './roll-number.ts';

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
  | {
      readonly ok: false;
      readonly kind: 'missing-shot-year';
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

function reservedNumber(folder: string): string | undefined {
  return /^(\d{4}-\d+)(?:-|$)/.exec(folder)?.[1];
}

function numberFor(year: string, suffix: number): string {
  return `${year}-${String(suffix).padStart(3, '0')}`;
}

/** Proposes shot-date numbers without changing filed or filtered-out rolls. */
export function numberingPreview(
  snapshot: readonly NumberingSnapshotRoll[],
  unreadable: readonly UnreadableRoll[],
  filters: NumberingFilters,
): NumberingPreview {
  const matching = snapshot.filter(({ roll }) => matches(roll, filters));
  const eligible = matching.filter(({ roll }) => !roll.filed);
  if (eligible.some(({ roll }) => roll.shot === null)) {
    return { ok: false, kind: 'missing-shot-year' };
  }

  const years = [
    ...new Set(eligible.map(({ roll }) => roll.shot?.slice(0, 4))),
  ].sort();
  const fixedNumbers = new Set(
    snapshot
      .filter(
        ({ roll }) =>
          roll.filed || !matching.some((match) => match.roll.id === roll.id),
      )
      .map(({ roll }) => roll.roll),
  );
  for (const entry of unreadable) {
    const number = reservedNumber(entry.folder);
    if (number !== undefined) {
      fixedNumbers.add(number);
    }
  }

  const changes: ProposedRollNumber[] = [];
  for (const year of years) {
    if (year === undefined) {
      continue;
    }
    const candidates = eligible
      .filter(({ roll }) => roll.shot?.slice(0, 4) === year)
      .sort((a, b) => {
        const byShot = (a.roll.shot ?? '').localeCompare(b.roll.shot ?? '');
        return byShot === 0
          ? compareRollNumbers(a.roll.roll, b.roll.roll)
          : byShot;
      });
    const highestFiled = snapshot.reduce((highest, { roll }) => {
      const suffix = /^(\d{4})-(\d+)$/.exec(roll.roll);
      if (!roll.filed || suffix?.[1] !== year) {
        return highest;
      }
      return Math.max(highest, Number(suffix[2]));
    }, 0);
    const occupied = [...fixedNumbers].filter((number) =>
      number.startsWith(`${year}-`),
    );
    let next = highestFiled + 1;
    for (const { roll } of candidates) {
      while (
        next <= 999 &&
        occupied.some((number) => sameRollNumber(number, numberFor(year, next)))
      ) {
        next += 1;
      }
      const proposed = numberFor(year, next);
      if (roll.roll !== proposed) {
        changes.push({ id: roll.id, roll: proposed });
      }
      next += 1;
    }
  }
  return { ok: true, changes };
}
