import type { ValidationFailed } from '../shared/domain-error.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { rollNumberMaxLength } from '../rolls/roll-number.ts';

/** The pattern used until one is saved, and for settings that predate patterns (D88). */
export const defaultRollNumberPattern = '{year}-{n:3}';

/** What a pattern needs of a roll, beyond a shot year, to number it. */
export interface RollNumberPatternNeeds {
  readonly shot: 'year' | 'month' | 'day';
  readonly event: boolean;
}

/** The most digits a sequence token's minimum width can ask for. */
const maxWidth = 9;

/** An event slug's longest length. */
const maxSlugLength = 60;

function invalid(message: string): Result<never, ValidationFailed> {
  return err({
    kind: 'validation-failed',
    issues: [{ path: ['rollNumberPattern'], message }],
  });
}

/**
 * What a roll number pattern needs of the rolls it numbers, or why it isn't a
 * pattern. A pattern is fixed text (anything but braces), exactly one
 * sequence token `{n:3}` (the digits are a minimum width) and optionally
 * `{year}`, `{month}`, `{day}` and `{event}` (D88). The web app has its own
 * copy of this grammar, which must agree.
 */
export function parseRollNumberPattern(
  source: string,
): Result<RollNumberPatternNeeds, ValidationFailed> {
  const tokens: string[] = [];
  let fixedLength = 0;
  let rest = source;
  while (rest !== '') {
    const open = rest.search(/[{}]/u);
    if (open === -1) {
      fixedLength += rest.length;
      break;
    }
    fixedLength += open;
    if (rest[open] === '}') {
      return invalid('has a } with no { before it');
    }
    const close = rest.indexOf('}', open);
    if (close === -1) {
      return invalid('has a { with no } after it');
    }
    const token = rest.slice(open + 1, close);
    if (token.includes('{')) {
      return invalid('has a { with no } after it');
    }
    tokens.push(token);
    rest = rest.slice(close + 1);
  }

  let sequences = 0;
  let longest = fixedLength;
  let shot: RollNumberPatternNeeds['shot'] = 'year';
  let event = false;
  for (const token of tokens) {
    const width = /^n:([1-9])$/u.exec(token)?.[1];
    if (width !== undefined) {
      sequences += 1;
      longest += Number(width);
    } else if (token === 'year') {
      longest += 4;
    } else if (token === 'month') {
      longest += 2;
      shot = shot === 'day' ? 'day' : 'month';
    } else if (token === 'day') {
      longest += 2;
      shot = 'day';
    } else if (token === 'event') {
      longest += maxSlugLength;
      event = true;
    } else {
      return invalid(
        `has {${token}}, which isn't one of {year}, {month}, {day}, {event} or {n:3} (width 1 to ${String(maxWidth)})`,
      );
    }
  }
  if (sequences !== 1) {
    return invalid(
      sequences === 0
        ? 'needs a sequence number like {n:3}'
        : 'can have only one sequence number like {n:3}',
    );
  }
  if (longest > rollNumberMaxLength) {
    return invalid(
      `could make roll numbers longer than ${String(rollNumberMaxLength)} characters`,
    );
  }
  return ok({ shot, event });
}

/** Whether a shot date is as precise as the pattern needs (a roll with none has no year either). */
export function shotHasPrecision(
  shot: string | null,
  needed: RollNumberPatternNeeds['shot'],
): boolean {
  if (needed === 'year') {
    return true;
  }
  if (shot === null) {
    return false;
  }
  return shot.length >= (needed === 'month' ? 7 : 10);
}
