import type { FrameId, VersionId } from '../shared/ids.ts';
import type { Roll, Version } from './roll.ts';

/** The version with this ID in the roll's frame with this ID, if there is one. */
export function findVersion(
  roll: Roll,
  frameId: FrameId,
  versionId: VersionId,
): Version | undefined {
  return roll.frames
    .find((frame) => frame.id === frameId)
    ?.versions.find((version) => version.id === versionId);
}
