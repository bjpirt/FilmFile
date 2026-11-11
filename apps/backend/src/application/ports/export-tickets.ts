import type { FrameId, RollId } from '../../domain/shared/ids.ts';
import type { ExportRecipe } from './image-renderer.ts';

/** A frame to be made and downloaded once, as the recipe says (D95). */
export interface QuickExport {
  readonly rollId: RollId;
  readonly frameId: FrameId;
  readonly recipe: ExportRecipe;
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
