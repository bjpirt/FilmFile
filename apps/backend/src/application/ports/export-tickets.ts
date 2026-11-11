import type { FrameId, RollId } from '../../domain/shared/ids.ts';
import type { ExportRecipe } from './image-renderer.ts';

/** How a zip's files are laid out: all in one place, a folder for each roll, or a folder for each year with one for each roll in it. */
export type Layout = 'flat' | 'roll-folder' | 'year-roll';

/** What the files are called and where they go, as the pattern and layout say (D94). */
export interface Naming {
  readonly layout: Layout;
  /** Text with `{roll}`, `{frame}`, `{title}`, `{year}` and `{original}` in it. */
  readonly pattern: string;
}

/** What is made: one frame as a JPEG, or any number as a zip of JPEGs. */
export type ExportOutput = 'jpeg' | 'zip';

/** Frames to be made and downloaded once, as the recipe says (D95). */
export interface QuickExport {
  readonly frames: readonly {
    readonly rollId: RollId;
    readonly frameId: FrameId;
  }[];
  readonly recipe: ExportRecipe;
  readonly output: ExportOutput;
  readonly naming: Naming;
  /** What to call a zip, if not the roll's name. */
  readonly name?: string | undefined;
}

/**
 * Single-use addresses for downloads: the page asks for a quick export, gets
 * a ticket, and follows it as an ordinary download, so the file is never held
 * by the page. A ticket works once, and not for long.
 */
export interface ExportTickets {
  /** A new ticket, unguessable, for this export. */
  issue(quick: QuickExport): string;
  /** The export a ticket is for, which no longer works afterwards; undefined if unknown, used or expired. */
  redeem(ticket: string): QuickExport | undefined;
}
