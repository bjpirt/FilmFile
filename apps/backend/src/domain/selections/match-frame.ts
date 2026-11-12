import { assertNever } from '../shared/assert-never.ts';
import type { FrameFacts } from './frame-facts.ts';
import type { FrameRef, Rule, Selection, SelectionMatch } from './selection.ts';

const isIn = <T>(values: readonly T[], value: T | undefined): boolean =>
  value !== undefined && values.includes(value);

/**
 * A date compared with a limit at the limit's precision: against September
 * 2026, any day in September 2026 is that month.
 */
function atLimitPrecision(shot: string, limit: string): string {
  return shot.slice(0, limit.length);
}

/** Whether a frame meets one rule. A frame missing what the rule is about doesn't. */
export function matchesRule(rule: Rule, frame: FrameFacts): boolean {
  switch (rule.kind) {
    case 'rating':
      return frame.rating !== null && frame.rating >= rule.atLeast;
    case 'event':
      return isIn(rule.events, frame.event);
    case 'roll':
      return rule.rolls.includes(frame.rollId);
    case 'camera':
      return isIn(rule.cameras, frame.camera);
    case 'lens':
      return isIn(rule.lenses, frame.lens);
    case 'film':
      return isIn(rule.films, frame.film);
    case 'shot-after':
      return (
        frame.shot !== undefined &&
        atLimitPrecision(frame.shot, rule.date) >= rule.date
      );
    case 'shot-before':
      return (
        frame.shot !== undefined &&
        atLimitPrecision(frame.shot, rule.date) <= rule.date
      );
    case 'has':
      return frame.versionKinds.has(rule.version);
    default:
      return assertNever(rule);
  }
}

const isRef = (refs: readonly FrameRef[], frame: FrameFacts): boolean =>
  refs.some(
    (ref) => ref.rollId === frame.rollId && ref.frameId === frame.frameId,
  );

/**
 * Whether the rules find a frame, and if so whether it's on the selection or
 * excluded by hand (D103). A frame must meet every rule (none: every frame);
 * a hidden frame (D99) is never found.
 */
export function matchSelection(
  selection: Selection,
  frame: FrameFacts,
): SelectionMatch | undefined {
  if (
    frame.hidden ||
    !selection.rules.every((rule) => matchesRule(rule, frame))
  ) {
    return undefined;
  }
  return isRef(selection.excluded, frame) ? 'excluded' : 'included';
}
