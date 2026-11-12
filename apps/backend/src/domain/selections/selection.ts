import type { Rating } from '../rolls/rating.ts';
import type { FrameId, RollId } from '../shared/ids.ts';
import type { Slug } from '../shared/slug.ts';

/** A frame, by where it is: its roll and its own ID. */
export interface FrameRef {
  readonly rollId: RollId;
  readonly frameId: FrameId;
}

/**
 * One condition a frame must meet (D93). Each kind has the values that suit
 * it; a list of values (events, cameras…) is "any of these".
 */
export type Rule =
  | { readonly kind: 'rating'; readonly atLeast: Rating }
  | { readonly kind: 'event'; readonly events: readonly Slug[] }
  | { readonly kind: 'roll'; readonly rolls: readonly RollId[] }
  | { readonly kind: 'camera'; readonly cameras: readonly Slug[] }
  | { readonly kind: 'lens'; readonly lenses: readonly Slug[] }
  | { readonly kind: 'film'; readonly films: readonly Slug[] }
  /** A year, month or day, compared at its own precision. */
  | { readonly kind: 'shot-after'; readonly date: string }
  | { readonly kind: 'shot-before'; readonly date: string }
  | { readonly kind: 'has'; readonly version: 'final' | 'raw-scan' };

export type RuleKind = Rule['kind'];

/**
 * Which frames: those meeting every rule, minus those `excluded` by hand
 * (D103). There is no way to include a frame the rules don't find.
 */
export interface Selection {
  readonly rules: readonly Rule[];
  readonly excluded: readonly FrameRef[];
}

/** A frame the rules find: on the selection, or excluded from it by hand. */
export type SelectionMatch = 'included' | 'excluded';
