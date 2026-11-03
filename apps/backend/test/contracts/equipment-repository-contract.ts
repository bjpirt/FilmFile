import { describe, expect, test } from 'vitest';
import type { EquipmentRepository } from '../../src/application/ports/equipment-repository.ts';
import { err, ok } from '../../src/domain/shared/result.ts';
import { aCamera, ctx } from '../support/builders.ts';

/** What every EquipmentRepository must do, run against each adapter. */
export function equipmentRepositoryContract(
  name: string,
  makeRepository: () => EquipmentRepository,
): void {
  describe(`${name} meets the EquipmentRepository contract`, () => {
    test('gets back exactly the camera created', async () => {
      const equipment = makeRepository();
      const camera = aCamera('Nikon FE');

      expect(await equipment.createCamera(ctx, camera)).toEqual(ok(undefined));
      expect(await equipment.getCamera(ctx, camera.slug)).toEqual(camera);
    });

    test('refuses to create a camera whose slug is taken, keeping the first', async () => {
      const equipment = makeRepository();
      await equipment.createCamera(ctx, aCamera('Nikon FE'));

      expect(
        await equipment.createCamera(ctx, {
          ...aCamera('Nikon FE'),
          name: 'nikon fe',
        }),
      ).toEqual(
        err({ kind: 'already-exists', entity: 'equipment', id: 'nikon-fe' }),
      );
      expect(await equipment.listCameras(ctx)).toEqual([aCamera('Nikon FE')]);
    });

    test('lists cameras in name order', async () => {
      const equipment = makeRepository();
      for (const name of ['Pentax K1000', 'leica M6', 'Nikon FE']) {
        await equipment.createCamera(ctx, aCamera(name));
      }

      expect(
        (await equipment.listCameras(ctx)).map((camera) => camera.name),
      ).toEqual(['leica M6', 'Nikon FE', 'Pentax K1000']);
    });

    test('lists nothing when there are no cameras', async () => {
      expect(await makeRepository().listCameras(ctx)).toEqual([]);
    });

    test('gets nothing for a slug no camera has', async () => {
      expect(
        await makeRepository().getCamera(ctx, aCamera('Nikon FE').slug),
      ).toBeUndefined();
    });
  });
}
