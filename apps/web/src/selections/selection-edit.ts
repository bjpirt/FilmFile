import type {
  FrameSelection,
  SelectionRule,
} from '@filmfile/contracts/selections';

/** A frame by its roll and its own ID. */
export interface FrameRef {
  readonly rollId: string;
  readonly frameId: string;
}

/** A selection of every frame: no rules, nothing excluded. */
export const everyFrame: FrameSelection = { rules: [], excluded: [] };

const same = (a: FrameRef, b: FrameRef): boolean =>
  a.rollId === b.rollId && a.frameId === b.frameId;

/** Just the roll and frame IDs, whatever else the caller's frame carries (the search's `excluded`). */
const refOf = (frame: FrameRef): FrameRef => ({
  rollId: frame.rollId,
  frameId: frame.frameId,
});

/** The × on a frame: off the selection, though the rules find it (D103). */
export function exclude(
  selection: FrameSelection,
  frame: FrameRef,
): FrameSelection {
  return {
    ...selection,
    excluded: [...include(selection, frame).excluded, refOf(frame)],
  };
}

/** The ↺ on an excluded frame: back to what the rules say. */
export function include(
  selection: FrameSelection,
  frame: FrameRef,
): FrameSelection {
  return {
    ...selection,
    excluded: selection.excluded.filter((ref) => !same(ref, frame)),
  };
}

export const isExcluded = (
  selection: FrameSelection,
  frame: FrameRef,
): boolean => selection.excluded.some((ref) => same(ref, frame));

/** What a rule is called in "Add a rule ▾" and on the rule itself. */
export const ruleLabels = {
  rating: 'Rated at least',
  event: 'Event is',
  roll: 'Roll is',
  camera: 'Camera is',
  lens: 'Lens is',
  film: 'Film stock is',
  'shot-after': 'Shot on or after',
  'shot-before': 'Shot on or before',
  'has-final': 'Has a Final',
  'has-raw-scan': 'Has a Raw scan',
} as const;

export type RuleChoice = keyof typeof ruleLabels;

/** The order the kinds are offered in. */
export const ruleChoices: readonly RuleChoice[] = [
  'rating',
  'event',
  'roll',
  'camera',
  'lens',
  'film',
  'shot-after',
  'shot-before',
  'has-final',
  'has-raw-scan',
];

/** Which entry in "Add a rule ▾" a rule is. */
export function choiceOf(rule: SelectionRule): RuleChoice {
  return rule.kind === 'has' ? `has-${rule.version}` : rule.kind;
}

/** A new rule of a kind, with nothing chosen yet (a date waits to be typed). */
export function newRule(choice: RuleChoice): SelectionRule {
  switch (choice) {
    case 'rating':
      return { kind: 'rating', atLeast: 4 };
    case 'event':
      return { kind: 'event', events: [] };
    case 'roll':
      return { kind: 'roll', rolls: [] };
    case 'camera':
      return { kind: 'camera', cameras: [] };
    case 'lens':
      return { kind: 'lens', lenses: [] };
    case 'film':
      return { kind: 'film', films: [] };
    case 'shot-after':
      return { kind: 'shot-after', date: '' };
    case 'shot-before':
      return { kind: 'shot-before', date: '' };
    case 'has-final':
      return { kind: 'has', version: 'final' };
    case 'has-raw-scan':
      return { kind: 'has', version: 'raw-scan' };
  }
}

/** The kinds not yet in the selection: each is added once. */
export function choicesLeft(
  rules: readonly SelectionRule[],
): readonly RuleChoice[] {
  const used = new Set(rules.map(choiceOf));
  return ruleChoices.filter((choice) => !used.has(choice));
}

const limitDate = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** Whether text is a year, month or day that exists: 2026, 2026-09, 2026-09-14. */
export function isLimitDate(text: string): boolean {
  const match = limitDate.exec(text);
  if (match === null) {
    return false;
  }
  const [, year, month, day] = match;
  if (month === undefined) {
    return true;
  }
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) {
    return false;
  }
  return (
    day === undefined ||
    (Number(day) >= 1 &&
      Number(day) <=
        new Date(Date.UTC(Number(year), monthNumber, 0)).getUTCDate())
  );
}

/**
 * The selection as it's searched: a date rule still waiting for a date it can
 * use is left out, rather than refused.
 */
export function searchable(selection: FrameSelection): FrameSelection {
  return {
    ...selection,
    rules: selection.rules.filter(
      (rule) =>
        (rule.kind !== 'shot-after' && rule.kind !== 'shot-before') ||
        isLimitDate(rule.date),
    ),
  };
}

/** "24 frames match", "1 frame matches", "No frames match", then ", 2 excluded" if any are. */
export function matchCount(count: number, excluded: number): string {
  const matching =
    count === 0
      ? 'No frames match'
      : count === 1
        ? '1 frame matches'
        : `${String(count)} frames match`;
  return excluded === 0
    ? matching
    : `${matching}, ${String(excluded)} excluded`;
}
