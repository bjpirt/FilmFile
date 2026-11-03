import { cameraLabel, type Camera } from '../../src/domain/equipment/camera.ts';
import { slugFor } from '../../src/domain/equipment/equipment-slug.ts';
import {
  filmStockLabel,
  type FilmStock,
} from '../../src/domain/equipment/film-stock.ts';
import type { Frame, Roll, Version } from '../../src/domain/rolls/roll.ts';
import { isFrameNumber } from '../../src/domain/rolls/frame-number.ts';
import { isRollNumber } from '../../src/domain/rolls/roll-number.ts';
import type { ArchiveContext } from '../../src/domain/shared/archive-context.ts';
import {
  isArchiveId,
  isFrameId,
  isRollId,
  isVersionId,
} from '../../src/domain/shared/ids.ts';
import { checked } from './checked.ts';

// Test data with sensible defaults: a test sets only what it's about, e.g.
// aRoll({ roll: '2025-003' }) or aRoll({ frames: labScanFrames(36) }).

export const ctx: ArchiveContext = {
  archiveId: checked('00000000000000000000000000', isArchiveId),
};

/** A ULID made from a number, e.g. 3 → 00000000000000000000000003. */
export function ulidFor(n: number): string {
  return String(n).padStart(26, '0');
}

export function aVersion(
  overrides: {
    readonly id?: string;
    readonly file?: string;
    readonly sha256?: string;
  } = {},
): Version {
  return {
    id: checked(overrides.id ?? ulidFor(3), isVersionId),
    file: overrides.file ?? 'frames/00000002/00000003/12340014.jpg',
    sha256: overrides.sha256 ?? 'a'.repeat(64),
    bytes: 1234,
    width: 3,
    height: 2,
    added: new Date('2026-11-02T12:00:00.000Z'),
  };
}

export function aFrame(
  overrides: {
    readonly id?: string;
    readonly number?: string | null;
    readonly versions?: readonly Version[];
  } = {},
): Frame {
  return {
    id: checked(overrides.id ?? ulidFor(2), isFrameId),
    number:
      overrides.number === undefined || overrides.number === null
        ? null
        : checked(overrides.number, isFrameNumber),
    versions: overrides.versions ?? [],
  };
}

export function aRoll(
  overrides: {
    readonly id?: string;
    readonly roll?: string;
    readonly frames?: readonly Frame[];
  } = {},
): Roll {
  return {
    id: checked(overrides.id ?? ulidFor(1), isRollId),
    roll: checked(overrides.roll ?? '2026-014', isRollNumber),
    name: null,
    description: null,
    shot: null,
    camera: null,
    film: null,
    frames: overrides.frames ?? [],
  };
}

/** A film stock by make and name, e.g. aFilmStock('Kodak', 'Portra', { iso: 400 }), with the slug made from them. */
export function aFilmStock(
  make: string,
  name: string,
  details: Partial<Pick<FilmStock, 'iso' | 'type' | 'format'>> = {},
): FilmStock {
  const iso = details.iso ?? null;
  const slug = slugFor(filmStockLabel({ make, name, iso }));
  if (slug === undefined) {
    throw new Error(`bad test data: ${make} ${name}`);
  }
  return {
    slug,
    make,
    name,
    iso,
    type: details.type ?? null,
    format: details.format ?? null,
  };
}

/** A camera by make and model, e.g. aCamera('Nikon', 'FE'), with the slug made from them. */
export function aCamera(make: string, model: string): Camera {
  const slug = slugFor(cameraLabel({ make, model }));
  if (slug === undefined) {
    throw new Error(`bad test data: ${make} ${model}`);
  }
  return { slug, make, model };
}

/**
 * Frames numbered 1 to `count`, each with a lab scan named 1234NNNN.jpg, as
 * a lab scanning head to tail would deliver them.
 */
export function labScanFrames(count: number): Frame[] {
  return Array.from({ length: count }, (_, i) => {
    const scan = `1234${String(i + 1).padStart(4, '0')}.jpg`;
    const frameId = ulidFor(1000 + i);
    const versionId = ulidFor(2000 + i);
    return aFrame({
      id: frameId,
      number: String(i + 1),
      versions: [
        aVersion({
          id: versionId,
          file: `frames/${frameId.slice(-8)}/${versionId.slice(-8)}/${scan}`,
          sha256: String(i + 1).padStart(64, '0'),
        }),
      ],
    });
  });
}
