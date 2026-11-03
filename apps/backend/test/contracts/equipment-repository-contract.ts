import { describe, expect, test } from 'vitest';
import type { EquipmentRepository } from '../../src/application/ports/equipment-repository.ts';
import { err, ok } from '../../src/domain/shared/result.ts';
import { aCamera, aFilmStock, aLens, ctx } from '../support/builders.ts';

/** What every EquipmentRepository must do, run against each adapter. */
export function equipmentRepositoryContract(
  name: string,
  makeRepository: () => EquipmentRepository,
): void {
  describe(`${name} meets the EquipmentRepository contract`, () => {
    test('gets back exactly the camera created', async () => {
      const equipment = makeRepository();
      const camera = aCamera('Nikon', 'FE');

      expect(await equipment.createCamera(ctx, camera)).toEqual(ok(undefined));
      expect(await equipment.getCamera(ctx, camera.slug)).toEqual(camera);
    });

    test('refuses to create a camera whose slug is taken, keeping the first', async () => {
      const equipment = makeRepository();
      await equipment.createCamera(ctx, aCamera('Nikon', 'FE'));

      expect(
        await equipment.createCamera(ctx, {
          ...aCamera('Nikon', 'FE'),
          make: 'nikon',
        }),
      ).toEqual(
        err({ kind: 'already-exists', entity: 'equipment', id: 'nikon-fe' }),
      );
      expect(await equipment.listCameras(ctx)).toEqual([
        aCamera('Nikon', 'FE'),
      ]);
    });

    test('lists cameras by make and model', async () => {
      const equipment = makeRepository();
      for (const [make, model] of [
        ['Pentax', 'K1000'],
        ['leica', 'M6'],
        ['Nikon', 'FE'],
        ['Nikon', 'F3'],
      ] as const) {
        await equipment.createCamera(ctx, aCamera(make, model));
      }

      expect(
        (await equipment.listCameras(ctx)).map((c) => `${c.make} ${c.model}`),
      ).toEqual(['leica M6', 'Nikon F3', 'Nikon FE', 'Pentax K1000']);
    });

    test('lists nothing when there are no cameras', async () => {
      expect(await makeRepository().listCameras(ctx)).toEqual([]);
    });

    test('gets nothing for a slug no camera has', async () => {
      expect(
        await makeRepository().getCamera(ctx, aCamera('Nikon', 'FE').slug),
      ).toBeUndefined();
    });

    test('gets back exactly the film stock created', async () => {
      const equipment = makeRepository();
      const film = aFilmStock('Kodak', 'Portra', {
        iso: 400,
        type: 'colour-negative',
        format: '120',
      });

      expect(await equipment.createFilmStock(ctx, film)).toEqual(ok(undefined));
      expect(await equipment.getFilmStock(ctx, film.slug)).toEqual(film);
    });

    test('keeps a film stock with no ISO, type or format', async () => {
      const equipment = makeRepository();
      const film = aFilmStock('Kodak', 'Portra 400');
      await equipment.createFilmStock(ctx, film);

      expect(await equipment.getFilmStock(ctx, film.slug)).toEqual(film);
    });

    test('refuses to create a film stock whose slug is taken, keeping the first', async () => {
      const equipment = makeRepository();
      await equipment.createFilmStock(ctx, aFilmStock('Kodak', 'Portra 400'));

      expect(
        await equipment.createFilmStock(
          ctx,
          aFilmStock('Kodak', 'Portra 400', { type: 'colour-negative' }),
        ),
      ).toEqual(
        err({
          kind: 'already-exists',
          entity: 'equipment',
          id: 'kodak-portra-400',
        }),
      );
      expect(await equipment.listFilmStocks(ctx)).toEqual([
        aFilmStock('Kodak', 'Portra 400'),
      ]);
    });

    test('lists film stocks by make, then name', async () => {
      const equipment = makeRepository();
      for (const [make, name] of [
        ['Kodak', 'Tri-X 400'],
        ['Ilford', 'HP5 Plus'],
        ['Kodak', 'Portra 400'],
      ] as const) {
        await equipment.createFilmStock(ctx, aFilmStock(make, name));
      }

      expect(
        (await equipment.listFilmStocks(ctx)).map((f) => `${f.make} ${f.name}`),
      ).toEqual(['Ilford HP5 Plus', 'Kodak Portra 400', 'Kodak Tri-X 400']);
    });

    test('lists film stocks differing only in speed slowest first', async () => {
      const equipment = makeRepository();
      for (const iso of [800, 1600, 160]) {
        await equipment.createFilmStock(
          ctx,
          aFilmStock('Kodak', 'Portra', { iso }),
        );
      }

      expect((await equipment.listFilmStocks(ctx)).map((f) => f.slug)).toEqual([
        'kodak-portra-160',
        'kodak-portra-800',
        'kodak-portra-1600',
      ]);
    });

    test('gets back exactly the lens created', async () => {
      const equipment = makeRepository();
      const lens = aLens('Nikon', 'Nikkor AI-S', {
        focalLength: 50,
        maxAperture: 1.8,
      });

      expect(await equipment.createLens(ctx, lens)).toEqual(ok(undefined));
      expect(await equipment.getLens(ctx, lens.slug)).toEqual(lens);
    });

    test('keeps a lens with no focal length or aperture', async () => {
      const equipment = makeRepository();
      const lens = aLens('Zeiss', 'Planar');
      await equipment.createLens(ctx, lens);

      expect(await equipment.getLens(ctx, lens.slug)).toEqual(lens);
    });

    test('refuses to create a lens whose slug is taken, keeping the first', async () => {
      const equipment = makeRepository();
      const lens = aLens('Nikon', 'Nikkor AI-S', { focalLength: 50 });
      await equipment.createLens(ctx, lens);

      expect(
        await equipment.createLens(ctx, { ...lens, make: 'NIKON' }),
      ).toEqual(
        err({
          kind: 'already-exists',
          entity: 'equipment',
          id: 'nikon-nikkor-ai-s-50mm',
        }),
      );
      expect(await equipment.listLenses(ctx)).toEqual([lens]);
    });

    test('lists lenses by make, name, then focal length by size', async () => {
      const equipment = makeRepository();
      for (const focalLength of [105, 50, 28]) {
        await equipment.createLens(
          ctx,
          aLens('Nikon', 'Nikkor AI-S', { focalLength }),
        );
      }
      await equipment.createLens(ctx, aLens('Leica', 'Summicron'));

      expect((await equipment.listLenses(ctx)).map((l) => l.slug)).toEqual([
        'leica-summicron',
        'nikon-nikkor-ai-s-28mm',
        'nikon-nikkor-ai-s-50mm',
        'nikon-nikkor-ai-s-105mm',
      ]);
    });

    test('lists nothing when there are no lenses', async () => {
      expect(await makeRepository().listLenses(ctx)).toEqual([]);
    });

    test('keeps cameras and film stocks apart, even with the same slug', async () => {
      const equipment = makeRepository();
      await equipment.createCamera(ctx, aCamera('Kodak', 'Retina'));
      await equipment.createFilmStock(ctx, aFilmStock('Kodak', 'Retina'));

      expect(await equipment.listCameras(ctx)).toHaveLength(1);
      expect(await equipment.listFilmStocks(ctx)).toHaveLength(1);
    });
  });
}
