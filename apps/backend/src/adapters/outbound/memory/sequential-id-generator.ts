import type { IdGenerator } from '../../../application/ports/id-generator.ts';
import {
  isArchiveId,
  isFrameId,
  isRollId,
  isVersionId,
  type ArchiveId,
  type FrameId,
  type RollId,
  type VersionId,
} from '../../../domain/shared/ids.ts';

/**
 * ULIDs counting up from 00000000000000000000000001, shared across kinds, so
 * tests can say which ID each new roll, frame and version gets.
 */
export class SequentialIdGenerator implements IdGenerator {
  #last = 0;

  #next<Id extends string>(isId: (value: string) => value is Id): Id {
    this.#last += 1;
    const id = String(this.#last).padStart(26, '0');
    if (!isId(id)) {
      throw new Error(`${id} is not a ULID`);
    }
    return id;
  }

  newArchiveId(): ArchiveId {
    return this.#next(isArchiveId);
  }

  newRollId(): RollId {
    return this.#next(isRollId);
  }

  newFrameId(): FrameId {
    return this.#next(isFrameId);
  }

  newVersionId(): VersionId {
    return this.#next(isVersionId);
  }
}
