import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { isSlug, type Slug } from '../shared/slug.ts';
import type { DetailsLayer } from './details.ts';
import { resolveDetails } from './resolve-details.ts';

function slug(value: string): Slug {
  if (!isSlug(value)) {
    throw new Error(`bad test data: ${value}`);
  }
  return value;
}

const archive = { layer: 'archive', id: 'A' } as const;
const roll = { layer: 'roll', id: 'R' } as const;
const frame = { layer: 'frame', id: 'F' } as const;

describe('scalars', () => {
  test('come from the most specific layer that sets them, saying which', () => {
    const layers: DetailsLayer[] = [
      { source: archive, details: { author: 'Ben Pirt', copyright: '© Ben' } },
      { source: roll, details: { camera: slug('nikon-fe'), author: 'Sam' } },
      { source: frame, details: { camera: slug('leica-m6') } },
    ];

    expect(resolveDetails(layers)).toEqual({
      author: { value: 'Sam', source: roll },
      copyright: { value: '© Ben', source: archive },
      camera: { value: 'leica-m6', source: frame },
    });
  });

  test('null clears what a less specific layer set', () => {
    expect(
      resolveDetails([
        { source: roll, details: { lens: slug('nikkor-50') } },
        { source: frame, details: { lens: null } },
      ]),
    ).toEqual({});
  });

  test('a detail left out is inherited, not cleared', () => {
    expect(
      resolveDetails([
        { source: roll, details: { film: slug('portra-400') } },
        { source: frame, details: {} },
      ]),
    ).toEqual({ film: { value: 'portra-400', source: roll } });
  });
});

describe('events', () => {
  const iceland = slug('iceland-2026');
  const westfjords = slug('westfjords');

  test('a frame event replaces the roll event and says where it came from', () => {
    expect(
      resolveDetails([
        { source: roll, details: { event: iceland } },
        { source: frame, details: { event: westfjords } },
      ]),
    ).toEqual({ event: { value: westfjords, source: frame } });
  });

  test('an omitted frame event inherits its roll event', () => {
    expect(
      resolveDetails([
        { source: roll, details: { event: iceland } },
        { source: frame, details: {} },
      ]),
    ).toEqual({ event: { value: iceland, source: roll } });
  });

  test('null clears the resolved event', () => {
    expect(
      resolveDetails([
        { source: roll, details: { event: iceland } },
        { source: frame, details: { event: null } },
      ]),
    ).toEqual({});
  });
});

test('the most specific layer to set a scalar always decides it', () => {
  const value = fc.option(fc.constantFrom('Ben', 'Sam', 'Kim'), {
    nil: undefined,
  });
  fc.assert(
    fc.property(value, value, value, (a, r, f) => {
      const set = (author: string | undefined) =>
        author === undefined ? {} : { author };
      const resolved = resolveDetails([
        { source: archive, details: set(a) },
        { source: roll, details: set(r) },
        { source: frame, details: set(f) },
      ]);
      const expected =
        f !== undefined
          ? { value: f, source: frame }
          : r !== undefined
            ? { value: r, source: roll }
            : a !== undefined
              ? { value: a, source: archive }
              : undefined;
      expect(resolved.author).toEqual(expected);
    }),
  );
});
