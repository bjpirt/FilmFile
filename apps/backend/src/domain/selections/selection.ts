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
 * Which frames: those meeting every rule, plus those `pinned` ("Always
 * include"), minus those `hidden` ("Never include"), which override the
 * rules. With none pinned or hidden it is its rules alone.
 */
export interface Selection {
  readonly rules: readonly Rule[];
  readonly pinned: readonly FrameRef[];
  readonly hidden: readonly FrameRef[];
}

/** Why a frame is on a selection. */
export type WhyOnSelection = 'rules' | 'pinned';
