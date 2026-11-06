import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { isFrameNumber } from '../../../domain/rolls/frame-number.ts';
import { isRollNumber } from '../../../domain/rolls/roll-number.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import { isShotDate } from '../../../domain/rolls/shot-date.ts';
import {
  isFrameId,
  isRollId,
  isVersionId,
} from '../../../domain/shared/ids.ts';
import { isSlug } from '../../../domain/shared/slug.ts';
import { parseRollFile, rollFileContent } from './roll-file.ts';

const ulid = fc.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/);

const aSlug = fc
  .stringMatching(/^[a-z0-9]{1,8}(-[a-z0-9]{1,8}){0,3}$/)
  .filter(isSlug);

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
  rotate: fc.constantFrom<0 | 90 | 180 | 270>(0, 90, 180, 270),
  kind: fc.constantFrom<'scan' | 'raw-scan' | 'final'>(
    'scan',
    'raw-scan',
    'final',
  ),
});

const aFrame = fc.record({
  id: ulid.filter(isFrameId),
  title: fc.option(fc.string(), { nil: null }),
  rating: fc.option(fc.constantFrom<1 | 2 | 3 | 4 | 5>(1, 2, 3, 4, 5), {
    nil: null,
  }),
  notes: fc.option(fc.string(), { nil: null }),
  camera: fc.option(aSlug, { nil: null }),
  lens: fc.option(aSlug, { nil: null }),
  event: fc.option(aSlug, { nil: null }),
  toScan: fc.boolean(),
  shot: fc.option(
    fc.constantFrom<string>('2026', '2026-09-15T06:30').filter(isShotDate),
    { nil: null },
  ),
  defaultVersion: fc.option(ulid.filter(isVersionId), { nil: null }),
  number: fc.option(
    fc.string({ minLength: 1, maxLength: 9 }).filter(isFrameNumber),
    { nil: null },
  ),
  versions: fc.array(aVersion, { maxLength: 3 }),
});

const aRoll: fc.Arbitrary<Roll> = fc.record({
  id: ulid.filter(isRollId),
  roll: fc.stringMatching(/^\d{4}-\d{3}$/).filter(isRollNumber),
  filed: fc.boolean(),
  name: fc.option(fc.string(), { nil: null }),
  notes: fc.option(fc.string(), { nil: null }),
  shot: fc.option(
    fc
      .constantFrom<string>('2026', '2026-09', '2026-09-14', '2026-09-14T15:30')
      .filter(isShotDate),
    { nil: null },
  ),
  film: fc.option(
    fc.stringMatching(/^[a-z0-9]{1,8}(-[a-z0-9]{1,8}){0,3}$/).filter(isSlug),
    { nil: null },
  ),
  event: fc.option(
    fc.stringMatching(/^[a-z0-9]{1,8}(-[a-z0-9]{1,8}){0,3}$/).filter(isSlug),
    { nil: null },
  ),
  lens: fc.option(
    fc.stringMatching(/^[a-z0-9]{1,8}(-[a-z0-9]{1,8}){0,3}$/).filter(isSlug),
    { nil: null },
  ),
  camera: fc.option(
    fc.stringMatching(/^[a-z0-9]{1,8}(-[a-z0-9]{1,8}){0,3}$/).filter(isSlug),
    { nil: null },
  ),
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

  test('keeps the camera, film stock and lens in the roll’s meta, by slug', () => {
    const roll = parseRollFile(
      JSON.stringify({
        schema: 1,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        roll: '2026-014',
        meta: {
          camera: 'nikon-fe',
          film: 'kodak-portra-400',
          lens: 'nikon-nikkor-50mm',
        },
        frames: [],
      }),
    );

    expect(roll).toMatchObject({
      ok: true,
      value: {
        camera: 'nikon-fe',
        film: 'kodak-portra-400',
        lens: 'nikon-nikkor-50mm',
      },
    });
    expect(roll.ok && JSON.parse(rollFileContent(roll.value))).toMatchObject({
      meta: {
        camera: 'nikon-fe',
        film: 'kodak-portra-400',
        lens: 'nikon-nikkor-50mm',
      },
    });
  });

  test('keeps a frame’s own details, and says nothing of those it inherits', () => {
    const json = {
      schema: 2,
      id: '01M6EAAP694BKWR9HZ4N5Z54XD',
      roll: '2026-014',
      frames: [
        {
          id: '01M6EAAP694BKWR9HZ4N5Z54XE',
          number: '1',
          versions: [],
        },
        {
          id: '01M6EAAP694BKWR9HZ4N5Z54XF',
          number: '2',
          event: 'iceland-2026',
          meta: { lens: 'nikon-nikkor-105mm' },
          versions: [],
        },
      ],
    };
    const read = parseRollFile(JSON.stringify(json));

    expect(read).toMatchObject({
      ok: true,
      value: {
        frames: [
          { camera: null, lens: null, event: null },
          {
            camera: null,
            lens: 'nikon-nikkor-105mm',
            event: 'iceland-2026',
          },
        ],
      },
    });
    const written: unknown = read.ok && JSON.parse(rollFileContent(read.value));
    expect(written).toEqual(
      expect.objectContaining({
        frames: [
          // Inheriting it all, it says nothing of meta or events, as before frames had their own.
          {
            id: '01M6EAAP694BKWR9HZ4N5Z54XE',
            number: '1',
            title: null,
            rating: null,
            notes: null,
            defaultVersion: null,
            versions: [],
          },
          expect.objectContaining({
            event: 'iceland-2026',
            meta: { lens: 'nikon-nikkor-105mm' },
          }),
        ],
      }),
    );
  });

  test('ignores a pre-release frame events array without migrating it', () => {
    const read = parseRollFile(
      JSON.stringify({
        schema: 2,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        roll: '2026-014',
        frames: [
          {
            id: '01M6EAAP694BKWR9HZ4N5Z54XE',
            number: '1',
            events: ['iceland-2026', 'westfjords'],
            versions: [],
          },
        ],
      }),
    );

    expect(read.ok).toBe(true);
    if (!read.ok) {
      return;
    }
    expect(read.value.frames[0]?.event).toBeNull();
    expect(rollFileContent(read.value)).not.toContain('"events"');
  });

  test('reads a frame without toScan as false and omits false when writing', () => {
    const read = parseRollFile(
      JSON.stringify({
        schema: 2,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        roll: '2026-014',
        frames: [
          {
            id: '01M6EAAP694BKWR9HZ4N5Z54XE',
            number: '1',
            versions: [],
          },
        ],
      }),
    );

    expect(read.ok && read.value.frames[0]?.toScan).toBe(false);
    expect(read.ok && rollFileContent(read.value)).not.toContain('"toScan"');
  });

  test('writes toScan only when true', () => {
    const read = parseRollFile(
      JSON.stringify({
        schema: 2,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        roll: '2026-014',
        frames: [
          {
            id: '01M6EAAP694BKWR9HZ4N5Z54XE',
            number: '1',
            toScan: true,
            versions: [],
          },
        ],
      }),
    );

    expect(read.ok && rollFileContent(read.value)).toContain('"toScan": true');
  });

  test('reads a version from before kinds as a scan, and writes a kind only when it isn’t one', () => {
    const read = parseRollFile(
      JSON.stringify({
        schema: 2,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        roll: '2026-014',
        frames: [
          {
            id: '01M6EAAP694BKWR9HZ4N5Z54XE',
            number: '1',
            versions: [
              {
                id: '01M6EAAP694BKWR9HZ4N5Z54XF',
                file: 'frames/x/y/12340001.jpg',
                sha256: 'a',
                bytes: 1,
                width: 1,
                height: 1,
                added: '2026-11-02T12:00:00.000Z',
              },
            ],
          },
        ],
      }),
    );

    expect(read.ok && read.value.frames[0]?.versions[0]?.kind).toBe('scan');
    expect(read.ok && rollFileContent(read.value)).not.toContain('"kind"');
  });

  test('leaves out a film stock a frame was given before frames couldn’t have one (D45)', () => {
    const read = parseRollFile(
      JSON.stringify({
        schema: 2,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        roll: '2026-014',
        frames: [
          {
            id: '01M6EAAP694BKWR9HZ4N5Z54XE',
            number: '1',
            meta: { film: 'kodak-gold-200', lens: 'nikon-nikkor-105mm' },
            versions: [],
          },
        ],
      }),
    );

    expect(read.ok && read.value.frames[0]).not.toHaveProperty('film');
    expect(read.ok && rollFileContent(read.value)).not.toContain(
      'kodak-gold-200',
    );
    expect(read.ok && rollFileContent(read.value)).toContain(
      'nikon-nikkor-105mm',
    );
  });

  test('reads a schema 1 roll’s description as its notes, and writes it back as notes', () => {
    const read = parseRollFile(
      JSON.stringify({
        schema: 1,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        roll: '2026-014',
        description: 'Developed in HC-110.',
        frames: [],
      }),
    );

    expect(read).toMatchObject({
      ok: true,
      value: { notes: 'Developed in HC-110.' },
    });
    const written: unknown = read.ok && JSON.parse(rollFileContent(read.value));
    expect(written).toMatchObject({ schema: 2, notes: 'Developed in HC-110.' });
    expect(written).not.toHaveProperty('description');
  });

  test('reads a roll written before rolls had a name, notes or date as having none', () => {
    const read = parseRollFile(
      JSON.stringify({
        schema: 1,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        roll: '2026-014',
        frames: [],
      }),
    );

    expect(read).toMatchObject({
      ok: true,
      value: {
        name: null,
        notes: null,
        shot: null,
        event: null,
        camera: null,
        film: null,
        lens: null,
      },
    });
  });

  test('reads a roll without a filed field as unfiled', () => {
    const read = parseRollFile(
      JSON.stringify({
        schema: 2,
        id: '01M6EAAP694BKWR9HZ4N5Z54XD',
        roll: '2026-014',
        frames: [],
      }),
    );

    expect(read).toMatchObject({
      ok: true,
      value: { filed: false },
    });
    if (!read.ok) {
      throw new Error(read.error);
    }

    const unfiledContent = rollFileContent(read.value);
    const filedContent = rollFileContent({ ...read.value, filed: true });

    expect(JSON.parse(unfiledContent)).not.toHaveProperty('filed');
    expect(JSON.parse(filedContent)).toMatchObject({ filed: true });
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
      JSON.stringify({ schema: 3 }),
      'written by a newer version of FilmFile (schema 3)',
    ],
    ['has no schema version', JSON.stringify({}), 'has no schema version'],
  ])('is reported, not read, when it %s', (_case, text, problem) => {
    const read = parseRollFile(text);

    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toContain(problem);
  });
});
