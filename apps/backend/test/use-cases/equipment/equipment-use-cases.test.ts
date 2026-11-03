import { describe, expect, test } from 'vitest';
import { InMemoryEquipmentRepository } from '../../../src/adapters/outbound/memory/in-memory-equipment-repository.ts';
import { CreateCamera } from '../../../src/application/use-cases/equipment/create-camera.ts';
import { ListCameras } from '../../../src/application/use-cases/equipment/list-cameras.ts';
import { ctx } from '../../support/builders.ts';

function setUp() {
  const equipment = new InMemoryEquipmentRepository();
  return {
    createCamera: new CreateCamera(equipment),
    listCameras: new ListCameras(equipment),
  };
}

describe('CreateCamera', () => {
  test('creates a camera with a slug made from its name, trimmed', async () => {
    const { createCamera, listCameras } = setUp();

    const created = await createCamera.execute(ctx, { name: ' Nikon FE ' });

    expect(created).toEqual({
      ok: true,
      value: { slug: 'nikon-fe', name: 'Nikon FE' },
    });
    expect(await listCameras.execute(ctx)).toEqual([
      { slug: 'nikon-fe', name: 'Nikon FE' },
    ]);
  });

  test('refuses a camera whose slug another camera has', async () => {
    const { createCamera } = setUp();
    await createCamera.execute(ctx, { name: 'Nikon FE' });

    expect(await createCamera.execute(ctx, { name: 'nikon  fe' })).toEqual({
      ok: false,
      error: { kind: 'already-exists', entity: 'equipment', id: 'nikon-fe' },
    });
  });

  test('refuses a name with no letters or digits', async () => {
    const { createCamera } = setUp();

    expect(await createCamera.execute(ctx, { name: ' -- ' })).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['name'] }] },
    });
  });
});
