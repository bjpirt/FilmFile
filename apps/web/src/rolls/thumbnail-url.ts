import type { Frame } from '@filmfile/contracts/rolls';

/**
 * A thumbnail of a frame's newest version, small for contact sheets or large
 * for the frame view, or undefined if it has no scan yet.
 */
export function thumbnailUrl(
  rollId: string,
  frame: Frame,
  size: 'small' | 'large' = 'small',
): string | undefined {
  // The newest version, until frames have a default version.
  const version = frame.versions.at(-1);
  return version === undefined
    ? undefined
    : `/api/rolls/${rollId}/frames/${frame.id}/versions/${version.id}/thumbnail?size=${size}`;
}
