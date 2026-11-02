import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { isRollNumber } from '../../../domain/rolls/roll-number.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import {
  isFrameId,
  isRollId,
  isVersionId,
} from '../../../domain/shared/ids.ts';
import { parseRollFile, rollFileContent } from './roll-file.ts';

const ulid = fc.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/);

const aVersion = fc.record({
  id: ulid.filter(isVersionId),
  file: fc.string(),
  sha256: fc.stringMatching(/^[0-9a-f]{64}$/),
  bytes: fc.nat(),
  width: fc.nat(),
  height: fc.nat(),
  added: fc.date({
    min: new Date('1970-01-01T00:00:00.000Z'),
    max: new Date('9999-12-31T23:59:59.999Z'),
    noInvalidDate: true,
  }),
});

const aFrame = fc.record({
  id: ulid.filter(isFrameId),
  number: fc.option(fc.string(), { nil: null }),
  versions: fc.array(aVersion, { maxLength: 3 }),
});

const aRoll: fc.Arbitrary<Roll> = fc.record({
  id: ulid.filter(isRollId),
  roll: fc.stringMatching(/^\d{4}-\d{3}$/).filter(isRollNumber),
  frames: fc.array(aFrame, { maxLength: 5 }),
});

describe('roll.json', () => {
  test('reads back exactly the roll that was written', () => {
    fc.assert(
      fc.property(aRoll, (roll) => {
        expect(parseRollFile(rollFileContent(roll))).toEqual({
          ok: true,
          value: roll,
        });
      }),
    );
  });

  test('is byte-identical when read and written again unchanged', () => {
    fc.assert(
      fc.property(aRoll, (roll) => {
        const written = rollFileContent(roll);
        const read = parseRollFile(written);

        expect(read.ok && rollFileContent(read.value)).toBe(written);
      }),
    );
  });

  test.each([
    ['is not JSON', '{ not json', 'not valid JSON'],
    [
      'lacks a field',
      JSON.stringify({
        schema: 1,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        frames: [],
      }),
      'roll: ',
    ],
    [
      'has a field of the wrong kind',
      JSON.stringify({
        schema: 1,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        roll: '2026-014',
        frames: [
          { id: '01M6EAAP694BKWR9HZ4N5Z54XE', number: 12, versions: [] },
        ],
      }),
      'frames.0.number: ',
    ],
    [
      'was written by a newer FilmFile',
      JSON.stringify({ schema: 2 }),
      'written by a newer version of FilmFile (schema 2)',
    ],
    ['has no schema version', JSON.stringify({}), 'has no schema version'],
  ])('is reported, not read, when it %s', (_case, text, problem) => {
    const read = parseRollFile(text);

    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toContain(problem);
  });
});
