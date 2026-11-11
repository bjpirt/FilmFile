import type { QuarterTurn } from '../../domain/rolls/quarter-turn.ts';

/** What an export says about the frame: everything known, or only who it's by. */
export type MetadataChoice = 'everything' | 'author-and-copyright';

/** How an exported image is made. */
export interface ExportRecipe {
  /** The longest edge in pixels, never enlarging; null for the image's full size. */
  readonly longestEdge: number | null;
  /** JPEG quality, 1 to 100. */
  readonly quality: number;
  readonly metadata: MetadataChoice;
}

/**
 * What an exported image says about itself, written as EXIF and XMP; only
 * what's given is written. Location is never part of it (FF-133).
 */
export interface ImageMetadata {
  readonly author?: string | undefined;
  readonly copyright?: string | undefined;
  readonly title?: string | undefined;
  /** The frame's notes. */
  readonly description?: string | undefined;
  /** When it was shot, as precisely as known: `2026`, `2026-09-14T15:30`… (D27). */
  readonly shot?: string | undefined;
  readonly cameraMake?: string | undefined;
  readonly cameraModel?: string | undefined;
  readonly lens?: string | undefined;
  readonly film?: string | undefined;
  /** Keywords: the film stock and the event. */
  readonly keywords?: readonly string[] | undefined;
  /** 1 to 5. */
  readonly rating?: number | undefined;
  /** Where it's from in the archive, e.g. `2026-014 / 12A`. */
  readonly reference?: string | undefined;
}

/** Makes the JPEGs that exports and sites are made of, from a version's file. */
export interface ImageRenderer {
  /**
   * A JPEG of the image file, turned clockwise by `rotate` (D41), at the
   * recipe's size and quality, carrying the metadata given. A raw is made
   * from the largest preview it carries.
   */
  render(
    file: Uint8Array,
    rotate: QuarterTurn,
    recipe: ExportRecipe,
    metadata: ImageMetadata,
  ): Promise<Uint8Array>;
}
