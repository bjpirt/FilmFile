import { describe, expect, test } from 'vitest';
import { InMemoryEquipmentRepository } from '../../../src/adapters/outbound/memory/in-memory-equipment-repository.ts';
import { CreateCamera } from '../../../src/application/use-cases/equipment/create-camera.ts';
import { CreateFilmStock } from '../../../src/application/use-cases/equipment/create-film-stock.ts';
import { ListCameras } from '../../../src/application/use-cases/equipment/list-cameras.ts';
import { ListFilmStocks } from '../../../src/application/use-cases/equipment/list-film-stocks.ts';
import { CreateLens } from '../../../src/application/use-cases/equipment/create-lens.ts';
import { ListLenses } from '../../../src/application/use-cases/equipment/list-lenses.ts';
import { ctx } from '../../support/builders.ts';

function setUp() {
  const equipment = new InMemoryEquipmentRepository();
  return {
    createCamera: new CreateCamera(equipment),
    listCameras: new ListCameras(equipment),
    createFilmStock: new CreateFilmStock(equipment),
    listFilmStocks: new ListFilmStocks(equipment),
    createLens: new CreateLens(equipment),
    listLenses: new ListLenses(equipment),
  };
}

describe('CreateCamera', () => {
  test('creates a camera with a slug made from its make and model, trimmed', async () => {
    const { createCamera, listCameras } = setUp();

    const created = await createCamera.execute(ctx, {
      make: ' Nikon ',
      model: 'FE ',
    });

    const camera = { slug: 'nikon-fe', make: 'Nikon', model: 'FE' };
    expect(created).toEqual({ ok: true, value: camera });
    expect(await listCameras.execute(ctx)).toEqual([camera]);
  });

  test('refuses a camera whose slug another camera has', async () => {
    const { createCamera } = setUp();
    await createCamera.execute(ctx, { make: 'Nikon', model: 'FE' });

    expect(
      await createCamera.execute(ctx, { make: 'nikon', model: 'fe' }),
    ).toEqual({
      ok: false,
      error: { kind: 'already-exists', entity: 'equipment', id: 'nikon-fe' },
    });
  });

  test.each([
    ['make', { make: ' ', model: 'FE' }],
    ['model', { make: 'Nikon', model: '' }],
  ])('needs a %s', async (field, input) => {
    const { createCamera } = setUp();

    expect(await createCamera.execute(ctx, input)).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: [field] }] },
    });
  });

  test('refuses a camera with no letters or digits', async () => {
    const { createCamera } = setUp();

    expect(
      await createCamera.execute(ctx, { make: '--', model: '!' }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['model'] }] },
    });
  });
});

describe('CreateFilmStock', () => {
  test('creates a film stock with a slug made from its make and name, trimmed', async () => {
    const { createFilmStock, listFilmStocks } = setUp();

    const created = await createFilmStock.execute(ctx, {
      make: ' Kodak ',
      name: 'Portra ',
      iso: 400,
      type: 'colour-negative',
      format: '35mm',
    });

    const film = {
      slug: 'kodak-portra-400',
      make: 'Kodak',
      name: 'Portra',
      iso: 400,
      type: 'colour-negative',
      format: '35mm',
    };
    expect(created).toEqual({ ok: true, value: film });
    expect(await listFilmStocks.execute(ctx)).toEqual([film]);
  });

  test('leaves out the ISO, type and format when not given', async () => {
    const { createFilmStock } = setUp();

    expect(
      await createFilmStock.execute(ctx, { make: 'Ilford', name: 'HP5 Plus' }),
    ).toMatchObject({
      ok: true,
      value: { iso: null, type: null, format: null },
    });
  });

  test('refuses a film stock whose slug another has', async () => {
    const { createFilmStock } = setUp();
    await createFilmStock.execute(ctx, {
      make: 'Kodak',
      name: 'Portra',
      iso: 400,
    });

    expect(
      await createFilmStock.execute(ctx, {
        make: 'kodak',
        name: 'portra',
        iso: 400,
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'already-exists',
        entity: 'equipment',
        id: 'kodak-portra-400',
      },
    });
  });

  test('tells apart film stocks differing only in speed', async () => {
    const { createFilmStock } = setUp();

    const slower = await createFilmStock.execute(ctx, {
      make: 'Kodak',
      name: 'Portra',
      iso: 160,
    });
    const faster = await createFilmStock.execute(ctx, {
      make: 'Kodak',
      name: 'Portra',
      iso: 400,
    });

    expect(slower).toMatchObject({
      ok: true,
      value: { slug: 'kodak-portra-160' },
    });
    expect(faster).toMatchObject({
      ok: true,
      value: { slug: 'kodak-portra-400' },
    });
  });

  test.each([
    ['make', { make: ' ', name: 'Portra 400' }],
    ['name', { make: 'Kodak', name: '' }],
  ])('needs a %s', async (field, input) => {
    const { createFilmStock } = setUp();

    expect(await createFilmStock.execute(ctx, input)).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: [field] }] },
    });
  });
});

describe('CreateLens', () => {
  test('creates a lens with a slug made from its make, name, focal length and aperture', async () => {
    const { createLens, listLenses } = setUp();

    const created = await createLens.execute(ctx, {
      make: ' Nikon',
      name: 'Nikkor AI-S ',
      focalLength: 50,
      maxAperture: 1.8,
    });

    const lens = {
      slug: 'nikon-nikkor-ai-s-50mm-f-1-8',
      make: 'Nikon',
      name: 'Nikkor AI-S',
      focalLength: 50,
      maxAperture: 1.8,
    };
    expect(created).toEqual({ ok: true, value: lens });
    expect(await listLenses.execute(ctx)).toEqual([lens]);
  });

  test('leaves out the focal length and aperture when not given', async () => {
    const { createLens } = setUp();

    expect(
      await createLens.execute(ctx, { make: 'Zeiss', name: 'Planar' }),
    ).toMatchObject({
      ok: true,
      value: { slug: 'zeiss-planar', focalLength: null, maxAperture: null },
    });
  });

  test('refuses a lens whose slug another has', async () => {
    const { createLens } = setUp();
    await createLens.execute(ctx, { make: 'Zeiss', name: 'Planar' });

    expect(
      await createLens.execute(ctx, { make: 'ZEISS', name: 'planar' }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'already-exists',
        entity: 'equipment',
        id: 'zeiss-planar',
      },
    });
  });

  test.each([
    ['make', { make: '', name: 'Planar' }],
    ['name', { make: 'Zeiss', name: ' ' }],
  ])('needs a %s', async (field, input) => {
    const { createLens } = setUp();

    expect(await createLens.execute(ctx, input)).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: [field] }] },
    });
  });
});
