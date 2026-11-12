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
import {
  eventGroupLabel,
  rollGroupLabel,
} from '../../../domain/sites/group-labels.ts';
import type { GroupLabel } from '../../../domain/sites/site-photo.ts';
import { compareShotOrder } from '../../../domain/selections/shot-order.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { EventRepository } from '../../ports/event-repository.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';

/** A frame the rules find, whether it's excluded by hand, and the headings it's grouped under. */
export interface FoundFrame {
  readonly rollId: FrameFacts['rollId'];
  readonly frameId: FrameFacts['frameId'];
  readonly excluded: boolean;
  readonly roll: GroupLabel;
  /** Absent when the frame is in no event, or its event has gone. */
  readonly event?: GroupLabel;
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
  readonly #events: EventRepository;

  constructor(
    rolls: RollRepository,
    settings: SettingsRepository,
    events: EventRepository,
  ) {
    this.#rolls = rolls;
    this.#settings = settings;
    this.#events = events;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly selection: Selection },
  ): Promise<readonly FoundFrame[]> {
    const settings = (await this.#settings.get(ctx))?.settings;
    const { rolls } = await this.#rolls.list(ctx);
    const events = new Map(
      (await this.#events.list(ctx)).map((event) => [
        event.slug,
        eventGroupLabel(event),
      ]),
    );
    const found: { facts: FrameFacts; frame: FoundFrame }[] = [];
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
          const event =
            facts.event === undefined ? undefined : events.get(facts.event);
          found.push({
            facts,
            frame: {
              rollId: facts.rollId,
              frameId: facts.frameId,
              excluded: match === 'excluded',
              roll: rollGroupLabel(roll),
              ...(event === undefined ? {} : { event }),
            },
          });
        }
      }
    }
    return found
      .sort((a, b) => compareShotOrder(a.facts, b.facts))
      .map(({ frame }) => frame);
  }
}
