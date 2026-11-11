import type {
  Credit,
  ExportRecipe,
  ImageRenderer,
} from '../../../application/ports/image-renderer.ts';
import type { QuarterTurn } from '../../../domain/rolls/quarter-turn.ts';

/**
 * Stands in for real JPEGs in tests: the "JPEG" is the text of what was
 * asked, e.g. `jpeg of scan turned 90 at 2048 px, quality 90, by Ben`.
 */
export class InMemoryImageRenderer implements ImageRenderer {
  render(
    file: Uint8Array,
    rotate: QuarterTurn,
    recipe: ExportRecipe,
    credit: Credit,
  ): Promise<Uint8Array> {
    const text = [
      `jpeg of ${new TextDecoder().decode(file)}`,
      rotate === 0 ? '' : ` turned ${String(rotate)}`,
      recipe.longestEdge === null
        ? ' at full size'
        : ` at ${String(recipe.longestEdge)} px`,
      `, quality ${String(recipe.quality)}`,
      credit.author === undefined ? '' : `, by ${credit.author}`,
      credit.copyright === undefined ? '' : `, ${credit.copyright}`,
    ].join('');
    return Promise.resolve(new TextEncoder().encode(text));
  }
}
