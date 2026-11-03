import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

describe('POST /api/equipment/cameras', () => {
  test('adds a camera, saved as its own file named by its slug', async () => {
    const response = await post('/api/equipment/cameras', {
      make: 'Nikon',
      model: 'FE',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      slug: 'nikon-fe',
      make: 'Nikon',
      model: 'FE',
    });
    expect(
      JSON.parse(
        await readFile(
          path.join(archive.path(), 'equipment/cameras/nikon-fe.json'),
          'utf8',
        ),
      ),
    ).toEqual({ schema: 2, make: 'Nikon', model: 'FE' });
  });

  test('refuses a camera whose slug another camera has', async () => {
    await post('/api/equipment/cameras', { make: 'Nikon', model: 'FE' });

    const response = await post('/api/equipment/cameras', {
      make: 'NIKON',
      model: 'FE',
    });

    expect(response.status).toBe(409);
  });

  test.each([
    ['no make', { model: 'FE' }],
    ['a blank model', { make: 'Nikon', model: ' ' }],
    ['a make that is too long', { make: 'x'.repeat(51), model: 'FE' }],
  ])('refuses %s', async (_, body) => {
    expect((await post('/api/equipment/cameras', body)).status).toBe(422);
  });
});

describe('GET /api/equipment/cameras', () => {
  test('lists the cameras by make and model', async () => {
    await post('/api/equipment/cameras', { make: 'Pentax', model: 'K1000' });
    await post('/api/equipment/cameras', { make: 'Nikon', model: 'FE' });

    const response = await request('/api/equipment/cameras');

    expect(await response.json()).toEqual({
      cameras: [
        { slug: 'nikon-fe', make: 'Nikon', model: 'FE' },
        { slug: 'pentax-k1000', make: 'Pentax', model: 'K1000' },
      ],
    });
  });

  test('reads a camera saved before makes and models were kept apart', async () => {
    await mkdir(path.join(archive.path(), 'equipment/cameras'), {
      recursive: true,
    });
    await writeFile(
      path.join(archive.path(), 'equipment/cameras/canon-ae-1-program.json'),
      JSON.stringify({ schema: 1, name: 'Canon AE-1 Program' }),
    );

    const response = await request('/api/equipment/cameras');

    expect(await response.json()).toEqual({
      cameras: [
        { slug: 'canon-ae-1-program', make: 'Canon', model: 'AE-1 Program' },
      ],
    });
  });
});

describe('POST /api/equipment/films', () => {
  test('adds a film stock, saved as its own file named by its slug', async () => {
    const response = await post('/api/equipment/films', {
      make: 'Kodak',
      name: 'Portra',
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
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(film);
    expect(
      JSON.parse(
        await readFile(
          path.join(archive.path(), 'equipment/films/kodak-portra-400.json'),
          'utf8',
        ),
      ),
    ).toEqual({
      schema: 1,
      make: 'Kodak',
      name: 'Portra',
      iso: 400,
      type: 'colour-negative',
      format: '35mm',
    });
    expect(await (await request('/api/equipment/films')).json()).toEqual({
      films: [film],
    });
  });

  test('refuses a film stock whose slug another has', async () => {
    await post('/api/equipment/films', { make: 'Kodak', name: 'Portra 400' });

    const response = await post('/api/equipment/films', {
      make: 'KODAK',
      name: 'Portra 400',
    });

    expect(response.status).toBe(409);
  });

  test.each([
    ['no make', { name: 'Portra 400' }],
    ['a blank name', { make: 'Kodak', name: '  ' }],
    ['an ISO that is not a whole number', { make: 'K', name: 'P', iso: 4.5 }],
    ['a type it does not know', { make: 'K', name: 'P', type: 'infrared' }],
    ['a format it does not know', { make: 'K', name: 'P', format: '70mm' }],
  ])('refuses %s', async (_, body) => {
    expect((await post('/api/equipment/films', body)).status).toBe(422);
  });
});

describe('a roll’s film stock', () => {
  test('is recorded when the roll is created, and cleared with its details', async () => {
    await post('/api/equipment/films', { make: 'Kodak', name: 'Portra 400' });
    const created: unknown = await (
      await post('/api/rolls', { roll: '2026-014', film: 'kodak-portra-400' })
    ).json();
    const url = `/api/rolls/${String(idOf(created))}`;
    const etag = (await request(url)).headers.get('ETag') ?? '';

    const changed = await request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({ film: null }),
    });

    expect(created).toMatchObject({ film: 'kodak-portra-400' });
    expect(await changed.json()).toMatchObject({ film: null });
  });

  test('must be a film stock in the archive', async () => {
    const response = await post('/api/rolls', {
      roll: '2026-014',
      film: 'kodak-portra-400',
    });

    expect(await response.json()).toMatchObject({
      issues: [{ path: ['film'] }],
    });
  });
});

describe('POST /api/equipment/lenses', () => {
  test('adds a lens, saved as its own file named by its slug, and lists it', async () => {
    const response = await post('/api/equipment/lenses', {
      make: 'Nikon',
      name: 'Nikkor AI-S',
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
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(lens);
    expect(
      JSON.parse(
        await readFile(
          path.join(
            archive.path(),
            'equipment/lenses/nikon-nikkor-ai-s-50mm-f-1-8.json',
          ),
          'utf8',
        ),
      ),
    ).toEqual({
      schema: 1,
      make: 'Nikon',
      name: 'Nikkor AI-S',
      focalLength: 50,
      maxAperture: 1.8,
    });
    expect(await (await request('/api/equipment/lenses')).json()).toEqual({
      lenses: [lens],
    });
  });

  test('refuses a lens whose slug another has', async () => {
    await post('/api/equipment/lenses', { make: 'Zeiss', name: 'Planar' });

    const response = await post('/api/equipment/lenses', {
      make: 'zeiss',
      name: 'Planar',
    });

    expect(response.status).toBe(409);
  });

  test.each([
    ['no name', { make: 'Zeiss' }],
    ['a focal length of nothing', { make: 'Z', name: 'P', focalLength: 0 }],
    ['an aperture below zero', { make: 'Z', name: 'P', maxAperture: -2 }],
  ])('refuses %s', async (_, body) => {
    expect((await post('/api/equipment/lenses', body)).status).toBe(422);
  });
});

describe('a roll’s lens', () => {
  test('is recorded when the roll is created', async () => {
    await post('/api/equipment/lenses', { make: 'Zeiss', name: 'Planar' });

    const created = await post('/api/rolls', {
      roll: '2026-014',
      lens: 'zeiss-planar',
    });

    expect(await created.json()).toMatchObject({ lens: 'zeiss-planar' });
  });

  test('must be a lens in the archive', async () => {
    const response = await post('/api/rolls', {
      roll: '2026-014',
      lens: 'zeiss-planar',
    });

    expect(await response.json()).toMatchObject({
      issues: [{ path: ['lens'] }],
    });
  });
});

describe('a roll’s camera', () => {
  test('is recorded when the roll is created, and changed with its details', async () => {
    await post('/api/equipment/cameras', { make: 'Nikon', model: 'FE' });
    await post('/api/equipment/cameras', { make: 'Pentax', model: 'K1000' });
    const created: unknown = await (
      await post('/api/rolls', { roll: '2026-014', camera: 'nikon-fe' })
    ).json();
    const url = `/api/rolls/${String(idOf(created))}`;
    const etag = (await request(url)).headers.get('ETag') ?? '';

    const changed = await request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({ camera: 'pentax-k1000' }),
    });

    expect(created).toMatchObject({ camera: 'nikon-fe' });
    expect(await changed.json()).toMatchObject({ camera: 'pentax-k1000' });
  });

  test('must be a camera in the archive', async () => {
    const response = await post('/api/rolls', {
      roll: '2026-014',
      camera: 'nikon-fe',
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: [{ path: ['camera'] }],
    });
  });
});
