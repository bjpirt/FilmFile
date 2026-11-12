import {
  archiveLayer,
  frameLayer,
  rollLayer,
} from '../../../domain/details/layers.ts';
import { resolveDetails } from '../../../domain/details/resolve-details.ts';
import {
  frameFactsOf,
  type FrameFacts,
} from '../../../domain/selections/frame-facts.ts';
import { matchSelection } from '../../../domain/selections/match-frame.ts';
import type { Selection } from '../../../domain/selections/selection.ts';
import { compareShotOrder } from '../../../domain/selections/shot-order.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';

/** A frame the rules find, and whether it's excluded by hand. */
export interface FoundFrame {
  readonly rollId: FrameFacts['rollId'];
  readonly frameId: FrameFacts['frameId'];
  readonly excluded: boolean;
}

/**
 * The frames across every roll that a selection's rules find (D93), in shot
 * order, worked out from the archive as it is now, each marked if it's
 * excluded by hand (D103). An excluded frame that has since gone is simply
 * not found; hidden frames (D99) never are.
 */
export class SearchFrames {
  readonly #rolls: RollRepository;
  readonly #settings: SettingsRepository;

  constructor(rolls: RollRepository, settings: SettingsRepository) {
    this.#rolls = rolls;
    this.#settings = settings;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly selection: Selection },
  ): Promise<readonly FoundFrame[]> {
    const settings = (await this.#settings.get(ctx))?.settings;
    const { rolls } = await this.#rolls.list(ctx);
    const found: { facts: FrameFacts; excluded: boolean }[] = [];
    for (const roll of rolls) {
      for (const frame of roll.frames) {
        const facts = frameFactsOf(
          roll,
          frame,
          resolveDetails([
            ...(settings === undefined ? [] : [archiveLayer(settings)]),
            rollLayer(roll),
            frameLayer(frame),
          ]),
        );
        const match = matchSelection(input.selection, facts);
        if (match !== undefined) {
          found.push({ facts, excluded: match === 'excluded' });
        }
      }
    }
    return found
      .sort((a, b) => compareShotOrder(a.facts, b.facts))
      .map(({ facts, excluded }) => ({
        rollId: facts.rollId,
        frameId: facts.frameId,
        excluded,
      }));
  }
}
