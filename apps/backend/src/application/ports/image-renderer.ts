import type { QuarterTurn } from '../../domain/rolls/quarter-turn.ts';

/** How an exported image is made. */
export interface ExportRecipe {
  /** The longest edge in pixels, never enlarging; null for the image's full size. */
  readonly longestEdge: number | null;
  /** JPEG quality, 1 to 100. */
  readonly quality: number;
}

/** What an exported image says about who made it. Nothing else is ever written (no location). */
export interface Credit {
  readonly author?: string | undefined;
  readonly copyright?: string | undefined;
}

/** Makes the JPEGs that exports and sites are made of, from a version's file. */
export interface ImageRenderer {
  /**
   * A JPEG of the image file, turned clockwise by `rotate` (D41), at the
   * recipe's size and quality, carrying only the credit. A raw is made from
   * the largest preview it carries.
   */
  render(
    file: Uint8Array,
    rotate: QuarterTurn,
    recipe: ExportRecipe,
    credit: Credit,
  ): Promise<Uint8Array>;
}
