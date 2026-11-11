import type { QuarterTurn } from '../rolls/quarter-turn.ts';

/**
 * The longest edges, in pixels, a site's photos are made at: a small one for
 * phones, a middle one, and the one the lightbox opens.
 */
export const siteLongestEdges: readonly number[] = [480, 960, 1600];

/**
 * Bumped whenever the way site images are made changes, so images made the
 * old way are made again.
 */
export const siteRenderingVersion = 1;

export interface SiteImageSize {
  /** What to ask the renderer for: its longest edge, never enlarging. */
  readonly longestEdge: number;
  /** The image's size once turned and scaled. */
  readonly width: number;
  readonly height: number;
}

/** A scan's size as shown: a quarter turn either way swaps its sides. */
export function turnedSize(
  width: number,
  height: number,
  rotate: QuarterTurn,
): { readonly width: number; readonly height: number } {
  return rotate === 90 || rotate === 270
    ? { width: height, height: width }
    : { width, height };
}

/**
 * The sizes a scan is made at, narrowest first. A scan smaller than a size
 * isn't enlarged, so it's made once at its own size rather than as several
 * copies.
 */
export function siteImageSizes(
  width: number,
  height: number,
  rotate: QuarterTurn,
): SiteImageSize[] {
  const shown = turnedSize(width, height, rotate);
  const longest = Math.max(shown.width, shown.height);
  const widest = Math.max(...siteLongestEdges);
  const edges = siteLongestEdges.filter((edge) => edge < longest);
  if (longest <= widest) {
    edges.push(longest);
  }
  return edges.map((longestEdge) => {
    const scale = longestEdge / longest;
    return {
      longestEdge,
      width: Math.max(1, Math.round(shown.width * scale)),
      height: Math.max(1, Math.round(shown.height * scale)),
    };
  });
}
