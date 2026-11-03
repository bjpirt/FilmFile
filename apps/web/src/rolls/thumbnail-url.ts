import type { Frame } from '@filmfile/contracts/rolls';
import { shownVersion } from './shown-version.ts';

/**
 * A thumbnail of the version shown for a frame, small for contact sheets or
 * large for the frame view, turned as the version is (D41), or undefined if
 * it has no scan yet. Each turn has its own address, so a turned version is
 * fetched afresh.
 */
export function thumbnailUrl(
  rollId: string,
  frame: Frame,
  size: 'small' | 'large' = 'small',
): string | undefined {
  const version = shownVersion(frame);
  return version === undefined
    ? undefined
    : `/api/rolls/${rollId}/frames/${frame.id}/versions/${version.id}/thumbnail?size=${size}${version.rotate === 0 ? '' : `&rotate=${String(version.rotate)}`}`;
}
