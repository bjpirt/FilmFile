import { describe, expect, test } from 'vitest';
import { exportMetadata } from '../../../src/application/use-cases/exports/export-metadata.ts';
import type { ResolvedDetails } from '../../../src/domain/details/details.ts';
import { isShotDate } from '../../../src/domain/rolls/shot-date.ts';
import {
  aCamera,
  aFilmStock,
  aFrame,
  aLens,
  anEvent,
  aRoll,
} from '../../support/builders.ts';
import { checked } from '../../support/checked.ts';

const nothingElse = {
  camera: undefined,
  lens: undefined,
  film: undefined,
  event: undefined,
};

describe('exportMetadata', () => {
  test('says only who it is by when that is all that is asked, whatever else is known', () => {
    const details: ResolvedDetails = {
      author: { value: 'Ben Pirt', source: { layer: 'archive', id: 'a' } },
      copyright: { value: '© Ben', source: { layer: 'archive', id: 'a' } },
      shot: {
        value: checked('2026-09-14', isShotDate),
        source: { layer: 'roll', id: 'r' },
      },
    };

    expect(
      exportMetadata({
        choice: 'author-and-copyright',
        details,
        roll: aRoll(),
        frame: { ...aFrame({ number: '1' }), title: 'Pond', rating: 5 },
        ...nothingElse,
      }),
    ).toEqual({ author: 'Ben Pirt', copyright: '© Ben' });
  });

  test('with everything, leaves out what the frame does not have', () => {
    const metadata = exportMetadata({
      choice: 'everything',
      details: {},
      roll: aRoll(),
      frame: aFrame({ number: null }),
      ...nothingElse,
    });

    expect(metadata).toMatchObject({ reference: '2026-014' });
    expect(metadata.keywords).toBeUndefined();
    expect(metadata.title).toBeUndefined();
    expect(metadata.rating).toBeUndefined();
    expect(metadata.film).toBeUndefined();
  });

  test('names the camera, lens, film and event, with the film and event as keywords', () => {
    const metadata = exportMetadata({
      choice: 'everything',
      details: {},
      roll: aRoll(),
      frame: aFrame({ number: '12A' }),
      camera: aCamera('Nikon', 'FE'),
      lens: aLens('Nikon', 'Nikkor', { focalLength: 50, maxAperture: 1.8 }),
      film: aFilmStock('Kodak', 'Portra', { iso: 400 }),
      event: anEvent('Iceland 2026'),
    });

    expect(metadata).toMatchObject({
      cameraMake: 'Nikon',
      cameraModel: 'FE',
      lens: 'Nikon Nikkor 50mm f/1.8',
      film: 'Kodak Portra 400',
      keywords: ['Kodak Portra 400', 'Iceland 2026'],
      reference: '2026-014 / 12A',
    });
  });
});
