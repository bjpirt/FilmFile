import {
  parseFrameNumber,
  type FrameNumber,
} from '../../../domain/rolls/frame-number.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  Issue,
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import type { FrameId, RollId } from '../../../domain/shared/ids.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type {
  RollRepository,
  VersionedRoll,
} from '../../ports/roll-repository.ts';

/**
 * Sets or clears many frames' numbers in one save, as renumbering a roll
 * does, if the roll hasn't changed since the caller read it at
 * `expectedVersion`. Either every number is saved or none is.
 */
export class UpdateFrameNumbers {
  readonly #rolls: RollRepository;

  constructor(rolls: RollRepository) {
    this.#rolls = rolls;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly rollId: RollId;
      readonly expectedVersion: string;
      readonly numbers: readonly {
        readonly frameId: FrameId;
        readonly number: string | null;
      }[];
    },
  ): Promise<
    Result<VersionedRoll, NotFound | ConcurrencyConflict | ValidationFailed>
  > {
    const numbers = new Map<FrameId, FrameNumber | null>();
    const issues: Issue[] = [];
    input.numbers.forEach(({ frameId, number }, i) => {
      const parsed = number === null ? ok(null) : parseFrameNumber(number);
      if (parsed.ok) {
        numbers.set(frameId, parsed.value);
      } else {
        issues.push(
          ...parsed.error.issues.map((issue) => ({
            ...issue,
            path: ['numbers', i, ...issue.path],
          })),
        );
      }
    });
    if (issues.length > 0) {
      return err({ kind: 'validation-failed', issues });
    }

    const current = await this.#rolls.get(ctx, input.rollId);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'roll', id: input.rollId });
    }
    const unknown = [...numbers.keys()].find(
      (frameId) => !current.roll.frames.some((f) => f.id === frameId),
    );
    if (unknown !== undefined) {
      return err({ kind: 'not-found', entity: 'frame', id: unknown });
    }

    const roll = {
      ...current.roll,
      frames: current.roll.frames.map((frame) => {
        const number = numbers.get(frame.id);
        return number === undefined ? frame : { ...frame, number };
      }),
    };
    // Saved against the version the caller read, so a change made since is never overwritten.
    const saved = await this.#rolls.save(ctx, roll, input.expectedVersion);
    return saved.ok ? ok({ roll, version: saved.value }) : saved;
  }
}
