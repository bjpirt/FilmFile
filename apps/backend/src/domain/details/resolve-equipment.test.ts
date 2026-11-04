import { expect, test } from 'vitest';
import type { Camera } from '../equipment/camera.ts';
import type { FilmStock } from '../equipment/film-stock.ts';
import type { Lens } from '../equipment/lens.ts';
import { isSlug, type Slug } from '../shared/slug.ts';
import { resolveEquipment } from './resolve-equipment.ts';

function slug(value: string): Slug {
  if (!isSlug(value)) {
    throw new Error(`bad test data: ${value}`);
  }
  return value;
}

const roll = { layer: 'roll', id: 'R' } as const;
const frame = { layer: 'frame', id: 'F' } as const;
const fe: Camera = { slug: slug('nikon-fe'), make: 'Nikon', model: 'FE' };
const portra: FilmStock = {
  slug: slug('kodak-portra-400'),
  make: 'Kodak',
  name: 'Portra',
  iso: 400,
  type: 'colour-negative',
  format: '35mm',
};
const noLenses: readonly Lens[] = [];
const records = { cameras: [fe], films: [portra], lenses: noLenses };

test('resolves each slug to its record, keeping where it came from', () => {
  expect(
    resolveEquipment(
      {
        camera: { value: fe.slug, source: roll },
        film: { value: portra.slug, source: frame },
      },
      records,
    ),
  ).toEqual({
    camera: { value: fe, source: roll },
    film: { value: portra, source: frame },
    dangling: [],
  });
});

test('reports a slug with no record, rather than failing', () => {
  expect(
    resolveEquipment(
      {
        camera: { value: slug('leica-m6'), source: frame },
        lens: { value: slug('nikkor-50'), source: roll },
      },
      records,
    ),
  ).toEqual({
    dangling: [
      { detail: 'camera', slug: 'leica-m6', source: frame },
      { detail: 'lens', slug: 'nikkor-50', source: roll },
    ],
  });
});

test('has nothing for details not set', () => {
  expect(resolveEquipment({}, records)).toEqual({ dangling: [] });
});
