import type { FrameId } from '../shared/ids.ts';
import type { QuarterTurn } from '../rolls/quarter-turn.ts';
import { siteRenderingVersion } from './site-image-sizes.ts';

/** Everything a site image is made from: when one changes, the image is made again. */
export interface SiteImageInputs {
  /** The version's own hash. */
  readonly sha256: string;
  readonly rotate: QuarterTurn;
  readonly longestEdge: number;
  /** The only metadata a site image carries. */
  readonly author: string | undefined;
  readonly copyright: string | undefined;
}

/** The inputs written as one piece of text, for hashing. */
export function siteImageInputsText(inputs: SiteImageInputs): string {
  return JSON.stringify([
    siteRenderingVersion,
    inputs.sha256,
    inputs.rotate,
    inputs.longestEdge,
    inputs.author ?? null,
    inputs.copyright ?? null,
  ]);
}

/**
 * Where a site image goes, relative to the site: the frame (by the end of
 * its ID, as folders are), the size, and the start of the hash of its inputs.
 * A different input is a different name, so a name already there is an image
 * that needn't be made again.
 */
export function siteImagePath(
  frame: FrameId,
  longestEdge: number,
  inputsHash: string,
): string {
  return `images/${frame.slice(-8)}-${String(longestEdge)}-${inputsHash.slice(0, 12)}.jpg`;
}
