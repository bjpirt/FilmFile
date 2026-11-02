import type { Frame, Roll, Version } from '../../src/domain/rolls/roll.ts';
import { isRollNumber } from '../../src/domain/rolls/roll-number.ts';
import type { ArchiveContext } from '../../src/domain/shared/archive-context.ts';
import {
  isArchiveId,
  isFrameId,
  isRollId,
  isVersionId,
} from '../../src/domain/shared/ids.ts';
import { checked } from './checked.ts';

export const ctx: ArchiveContext = {
  archiveId: checked('00000000000000000000000000', isArchiveId),
};

export function aRoll(roll: string, id = '00000000000000000000000001'): Roll {
  return {
    id: checked(id, isRollId),
    roll: checked(roll, isRollNumber),
    frames: [],
  };
}

export function aFrame(id: string, versions: readonly Version[] = []): Frame {
  return { id: checked(id, isFrameId), number: null, versions };
}

export const aVersion: Version = {
  id: checked('00000000000000000000000003', isVersionId),
  file: 'frames/00000002/00000003/12340014.jpg',
  sha256: 'a'.repeat(64),
  bytes: 1234,
  width: 3,
  height: 2,
  added: new Date('2026-11-02T12:00:00.000Z'),
};
