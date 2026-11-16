import type {
  ConcurrencyConflict,
  ValidationFailed,
} from '../shared/domain-error.ts';
import type { RollId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { folderHoldsNumber } from './folder-holds-number.ts';
import {
  filedRollNumberMessage,
  mayChangeRollNumber,
} from './roll-number-change.ts';
import { rollNumbersAreUnique, type RollNumber } from './roll-number.ts';
import type { Roll } from './roll.ts';
import type { UnreadableRoll } from './unreadable-roll.ts';

function invalid(
  path: string,
  message: string,
): Result<never, ValidationFailed> {
  return err({
    kind: 'validation-failed',
    issues: [{ path: [path], message }],
  });
}

function conflict(id: string): Result<never, ConcurrencyConflict> {
  return err({ kind: 'concurrency-conflict', entity: 'roll', id });
}

function sortedByFolder(entries: readonly UnreadableRoll[]): string {
  return JSON.stringify(
    [...entries].sort((a, b) => a.folder.localeCompare(b.folder)),
  );
}

/**
 * Checks a batch renumbering against the archive as it is now and gives the
 * rolls whose numbers really change, in the order of `current`, or why it
 * can't be applied. `expected` is the snapshot the caller worked from, so a
 * roll changed, added or lost since is a conflict. Pure: the repository runs
 * it inside its lock, so what it checked is what it then changes.
 */
export function planRollRenumbering(input: {
  readonly current: readonly {
    readonly roll: Roll;
    readonly version: string;
  }[];
  readonly currentUnreadable: readonly UnreadableRoll[];
  readonly expected: readonly {
    readonly id: RollId;
    readonly version: string;
  }[];
  readonly expectedUnreadable: readonly UnreadableRoll[];
  readonly changes: readonly {
    readonly id: RollId;
    readonly roll: RollNumber;
  }[];
}): Result<
  readonly { readonly id: RollId; readonly roll: RollNumber }[],
  ConcurrencyConflict | ValidationFailed
> {
  const { current, expected, changes } = input;
  const expectedById = new Map(expected.map((entry) => [entry.id, entry]));
  if (expectedById.size !== expected.length) {
    return invalid('snapshot', 'contains a duplicate roll');
  }

  const currentById = new Map(current.map((entry) => [entry.roll.id, entry]));
  for (const entry of expected) {
    if (currentById.get(entry.id)?.version !== entry.version) {
      return conflict(entry.id);
    }
  }
  const added = current.find((entry) => !expectedById.has(entry.roll.id));
  if (added !== undefined || expected.length !== current.length) {
    return conflict(added?.roll.id ?? expected[0]?.id ?? 'listing');
  }
  if (
    sortedByFolder(input.currentUnreadable) !==
    sortedByFolder(input.expectedUnreadable)
  ) {
    return conflict('unreadable');
  }

  const changesById = new Map(changes.map((change) => [change.id, change]));
  if (changesById.size !== changes.length) {
    return invalid('changes', 'contains a duplicate roll');
  }
  for (const change of changes) {
    const found = currentById.get(change.id);
    if (found === undefined || !expectedById.has(change.id)) {
      return invalid('changes', 'includes an unknown roll');
    }
    if (!mayChangeRollNumber(found.roll) && found.roll.roll !== change.roll) {
      return invalid('roll', filedRollNumberMessage);
    }
  }

  const finalNumbers = current.map(
    ({ roll }) => changesById.get(roll.id)?.roll ?? roll.roll,
  );
  if (!rollNumbersAreUnique(finalNumbers)) {
    return invalid('changes', 'roll numbers must be unique');
  }
  if (
    finalNumbers.some((number) =>
      input.currentUnreadable.some((entry) =>
        folderHoldsNumber(entry.folder, number),
      ),
    )
  ) {
    return invalid(
      'changes',
      'a roll number is used by an unreadable roll folder',
    );
  }

  return ok(
    current.flatMap(({ roll }) => {
      const change = changesById.get(roll.id);
      return change === undefined || change.roll === roll.roll ? [] : [change];
    }),
  );
}
