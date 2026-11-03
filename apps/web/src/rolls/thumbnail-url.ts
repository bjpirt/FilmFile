import type { Frame } from '@filmfile/contracts/rolls';
import { shownVersion } from './shown-version.ts';

/**
 * A thumbnail of the version shown for a frame, small for contact sheets or
 * large for the frame view, or undefined if it has no scan yet.
 */
export function thumbnailUrl(
  rollId: string,
  frame: Frame,
  size: 'small' | 'large' = 'small',
): string | undefined {
  const version = shownVersion(frame);
  return version === undefined
    ? undefined
    : `/api/rolls/${rollId}/frames/${frame.id}/versions/${version.id}/thumbnail?size=${size}`;
}
