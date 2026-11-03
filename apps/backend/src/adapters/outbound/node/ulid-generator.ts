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
import { newUlid } from './new-ulid.ts';

function brandedUlid<Id extends string>(
  isId: (value: string) => value is Id,
): Id {
  const id = newUlid();
  if (!isId(id)) {
    throw new Error(`newUlid made ${id}, which is not a ULID`);
  }
  return id;
}

/** ULIDs from the system clock and random numbers. */
export class UlidGenerator implements IdGenerator {
  newArchiveId(): ArchiveId {
    return brandedUlid(isArchiveId);
  }

  newRollId(): RollId {
    return brandedUlid(isRollId);
  }

  newFrameId(): FrameId {
    return brandedUlid(isFrameId);
  }

  newVersionId(): VersionId {
    return brandedUlid(isVersionId);
  }
}
