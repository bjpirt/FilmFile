import { sameRollNumber } from './roll-number.ts';

// The roll number pattern (D88): fixed text, one sequence token `{n:3}` (its
// digits are a minimum width) and optionally `{year}`, `{month}`, `{day}` and
// `{event}`. The service has its own copy of this grammar, which must agree.

export const defaultRollNumberPattern = '{year}-{n:3}';

/** The most characters a roll number can have. */
const maxLength = 100;
const maxSlugLength = 60;

type Part =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'year' | 'month' | 'day' | 'event' }
  | { readonly kind: 'n'; readonly width: number };

/** What a roll has that a pattern uses: its shot date and event. */
export interface RollFacts {
  readonly shot: string | null;
  readonly event: string | null;
}

export interface RollNumberPattern {
  readonly parts: readonly Part[];
  /** How precise a shot date every roll needs. */
  readonly shot: 'year' | 'month' | 'day';
  /** Whether every roll needs an event. */
  readonly event: boolean;
}

export type ParsedPattern =
  | { readonly ok: true; readonly pattern: RollNumberPattern }
  | { readonly ok: false; readonly message: string };

function refused(message: string): ParsedPattern {
  return { ok: false, message };
}

export function parseRollNumberPattern(source: string): ParsedPattern {
  const parts: Part[] = [];
  let longest = 0;
  let sequences = 0;
  let rest = source;
  while (rest !== '') {
    const open = rest.search(/[{}]/u);
    if (open === -1) {
      parts.push({ kind: 'text', text: rest });
      longest += rest.length;
      break;
    }
    if (open > 0) {
      parts.push({ kind: 'text', text: rest.slice(0, open) });
      longest += open;
    }
    if (rest[open] === '}') {
      return refused('has a } with no { before it');
    }
    const close = rest.indexOf('}', open);
    const token = close === -1 ? '' : rest.slice(open + 1, close);
    if (close === -1 || token.includes('{')) {
      return refused('has a { with no } after it');
    }
    const width = /^n:([1-9])$/u.exec(token)?.[1];
    if (width !== undefined) {
      sequences += 1;
      longest += Number(width);
      parts.push({ kind: 'n', width: Number(width) });
    } else if (token === 'year' || token === 'month' || token === 'day') {
      longest += token === 'year' ? 4 : 2;
      parts.push({ kind: token });
    } else if (token === 'event') {
      longest += maxSlugLength;
      parts.push({ kind: 'event' });
    } else {
      return refused(
        `has {${token}}, which isn't one of {year}, {month}, {day}, {event} or {n:3} (width 1 to 9)`,
      );
    }
    rest = rest.slice(close + 1);
  }
  if (sequences !== 1) {
    return refused(
      sequences === 0
        ? 'needs a sequence number like {n:3}'
        : 'can have only one sequence number like {n:3}',
    );
  }
  if (longest > maxLength) {
    return refused(
      `could make roll numbers longer than ${String(maxLength)} characters`,
    );
  }
  const has = (kind: Part['kind']) => parts.some((part) => part.kind === kind);
  return {
    ok: true,
    pattern: {
      parts,
      shot: has('day') ? 'day' : has('month') ? 'month' : 'year',
      event: has('event'),
    },
  };
}

/** The pattern saved, or the default if what's saved can't be read. */
export function patternOf(source: string): RollNumberPattern {
  const parsed = parseRollNumberPattern(source);
  if (parsed.ok) {
    return parsed.pattern;
  }
  const fallback = parseRollNumberPattern(defaultRollNumberPattern);
  if (!fallback.ok) {
    throw new Error('the default roll number pattern is not valid');
  }
  return fallback.pattern;
}

function shotPart(
  kind: 'year' | 'month' | 'day',
  shot: string | null,
): string | undefined {
  const part =
    kind === 'year'
      ? shot?.slice(0, 4)
      : kind === 'month'
        ? shot?.slice(5, 7)
        : shot?.slice(8, 10);
  return part === undefined || part === '' ? undefined : part;
}

/** What of a roll the pattern lacks, e.g. "a shot month", or undefined if it has it all. */
export function whatIsMissing(
  pattern: RollNumberPattern,
  facts: RollFacts,
): string | undefined {
  for (const part of pattern.parts) {
    if (
      (part.kind === 'year' || part.kind === 'month' || part.kind === 'day') &&
      shotPart(part.kind, facts.shot) === undefined
    ) {
      return `a shot ${part.kind}`;
    }
  }
  return pattern.event && facts.event === null ? 'an event' : undefined;
}

/** What stands in a number for a month, day or event a roll doesn't have yet (FF-154, D90). */
const placeholders = { month: 'MM', day: 'DD', event: 'event' } as const;

/**
 * Renders the number a roll gets at sequence value `n`, or undefined if it
 * lacks what the pattern uses. With `placeholder`, a missing month, day or
 * event is "MM", "DD" or "event" instead, for rolls given their details
 * later.
 */
export function renderRollNumber(
  pattern: RollNumberPattern,
  facts: RollFacts,
  n: number,
  placeholder = false,
): string | undefined {
  let label = '';
  for (const part of pattern.parts) {
    switch (part.kind) {
      case 'text':
        label += part.text;
        break;
      case 'n':
        label += String(n).padStart(part.width, '0');
        break;
      case 'event':
        if (facts.event === null) {
          if (!placeholder) {
            return undefined;
          }
          label += placeholders.event;
        } else {
          label += facts.event;
        }
        break;
      case 'year':
      case 'month':
      case 'day': {
        const value = shotPart(part.kind, facts.shot);
        if (value !== undefined) {
          label += value;
        } else if (placeholder && part.kind !== 'year') {
          label += placeholders[part.kind];
        } else {
          return undefined;
        }
        break;
      }
    }
  }
  return label;
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Splits a roll number made by the pattern into its group (the date and
 * event values it counts within) and its sequence value; undefined for a
 * number that isn't in the pattern's form.
 */
export function readRollNumber(
  pattern: RollNumberPattern,
  label: string,
): { readonly group: string; readonly n: number } | undefined {
  const expression = pattern.parts
    .map((part) => {
      switch (part.kind) {
        case 'text':
          return escaped(part.text);
        case 'year':
          return '(\\d{4})';
        case 'month':
        case 'day':
          return '(\\d{2})';
        case 'event':
          return '([a-z0-9]+(?:-[a-z0-9]+)*)';
        case 'n':
          return '(\\d+)';
      }
    })
    .join('');
  const found = new RegExp(`^${expression}$`, 'iu').exec(label);
  if (found === null) {
    return undefined;
  }
  const values: string[] = [];
  let n: number | undefined;
  pattern.parts
    .filter((part) => part.kind !== 'text')
    .forEach((part, index) => {
      const value = found[index + 1] ?? '';
      if (part.kind === 'n') {
        n = Number(value);
      } else {
        values.push(value.toLowerCase());
      }
    });
  return n === undefined ? undefined : { group: values.join('\0'), n };
}

/** The group a roll counts within: its date and event values the pattern uses. */
export function groupOf(
  pattern: RollNumberPattern,
  facts: RollFacts,
): string | undefined {
  const rendered = renderRollNumber(pattern, facts, 1);
  return rendered === undefined
    ? undefined
    : readRollNumber(pattern, rendered)?.group;
}

/**
 * Labels that can't be given out: roll numbers, and the names of roll folders
 * that can't be read, with or without the ID after the label.
 */
export function occupiedLabels(
  rollNumbers: readonly string[],
  unreadableFolders: readonly string[],
): string[] {
  return [
    ...rollNumbers,
    ...unreadableFolders.flatMap((folder) => {
      const label = /^(.+)-[0-9A-HJKMNP-TV-Z]{8}$/iu.exec(folder)?.[1];
      return label === undefined ? [folder] : [folder, label];
    }),
  ];
}

/** The first sequence value from `from` whose number isn't occupied, with that number. */
export function firstFreeNumber(
  pattern: RollNumberPattern,
  facts: RollFacts,
  from: number,
  occupied: readonly string[],
  placeholder = false,
): string | undefined {
  for (let n = from; ; n += 1) {
    const label = renderRollNumber(pattern, facts, n, placeholder);
    if (label === undefined) {
      return undefined;
    }
    if (!occupied.some((taken) => sameRollNumber(taken, label))) {
      return label;
    }
  }
}

/**
 * The next free number for a roll (D88): after the highest of its group
 * among `occupied`, so a gap a deleted roll left isn't reused, skipping any
 * number that is occupied. Undefined if the roll lacks what the pattern uses.
 */
export function suggestRollNumber(
  pattern: RollNumberPattern,
  facts: RollFacts,
  occupied: readonly string[],
): string | undefined {
  const group = groupOf(pattern, facts);
  if (group === undefined) {
    return undefined;
  }
  let highest = 0;
  for (const label of occupied) {
    const read = readRollNumber(pattern, label);
    if (read?.group === group) {
      highest = Math.max(highest, read.n);
    }
  }
  return firstFreeNumber(pattern, facts, highest + 1, occupied);
}

/** An example of what the pattern makes, for the settings page. */
export function exampleRollNumber(pattern: RollNumberPattern): string {
  return (
    renderRollNumber(
      pattern,
      { shot: '2026-09-14', event: 'iceland-2026' },
      14,
    ) ?? ''
  );
}

/**
 * The next free number for a roll being imported before its details are all
 * known (D90): as `suggestRollNumber` when it has what the pattern uses,
 * else with "MM", "DD" or "event" in place of what's missing, counting up
 * past the numbers already given out with them.
 */
export function suggestImportedNumber(
  pattern: RollNumberPattern,
  facts: RollFacts,
  occupied: readonly string[],
): string | undefined {
  return whatIsMissing(pattern, facts) === undefined
    ? suggestRollNumber(pattern, facts, occupied)
    : firstFreeNumber(pattern, facts, 1, occupied, true);
}
