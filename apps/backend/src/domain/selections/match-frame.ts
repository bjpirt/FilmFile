import { assertNever } from '../shared/assert-never.ts';
import type { FrameFacts } from './frame-facts.ts';
import type { FrameRef, Rule, Selection, WhyOnSelection } from './selection.ts';

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
 * Whether a frame is on a selection, and why. A hidden frame (D99) is never
 * on one; one left off by hand isn't; one included by hand is, whatever the
 * rules say; otherwise it must meet every rule (none: every frame).
 */
export function whyOnSelection(
  selection: Selection,
  frame: FrameFacts,
): WhyOnSelection | undefined {
  if (frame.hidden || isRef(selection.hidden, frame)) {
    return undefined;
  }
  if (isRef(selection.pinned, frame)) {
    return 'pinned';
  }
  return selection.rules.every((rule) => matchesRule(rule, frame))
    ? 'rules'
    : undefined;
}
