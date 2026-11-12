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
import { whyOnSelection } from '../../../domain/selections/match-frame.ts';
import type {
  Selection,
  WhyOnSelection,
} from '../../../domain/selections/selection.ts';
import { compareShotOrder } from '../../../domain/selections/shot-order.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';

/** A frame on a selection, and why it is. */
export interface FoundFrame {
  readonly rollId: FrameFacts['rollId'];
  readonly frameId: FrameFacts['frameId'];
  readonly why: WhyOnSelection;
}

/**
 * The frames across every roll that are on a selection (D93), in shot order,
 * worked out from the archive as it is now. Frames pinned or left off that
 * have since gone are simply not found; hidden frames (D99) never are.
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
    const found: { facts: FrameFacts; why: WhyOnSelection }[] = [];
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
        const why = whyOnSelection(input.selection, facts);
        if (why !== undefined) {
          found.push({ facts, why });
        }
      }
    }
    return found
      .sort((a, b) => compareShotOrder(a.facts, b.facts))
      .map(({ facts, why }) => ({
        rollId: facts.rollId,
        frameId: facts.frameId,
        why,
      }));
  }
}
