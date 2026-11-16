import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { InMemoryErrorReporter } from '../../src/adapters/outbound/memory/in-memory-error-reporter.ts';
import { localStartup } from '../../src/composition/compose-local.ts';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf } from '../support/api.ts';
import { folderOfRoll } from '../support/roll-folder.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

/** A roll with two frames, each with a scan, made through the API. */
async function aLibraryWithImages(): Promise<{
  readonly images: string[];
  readonly rollJson: string;
}> {
  const rollId = String(
    idOf(
      await (
        await post('/api/rolls', { roll: '2026-014', shot: '2026' })
      ).json(),
    ),
  );
  const images: string[] = [];
  for (const [index, name] of ['12340001.jpg', '12340002.jpg'].entries()) {
    const frame = String(
      idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
    );
    const version = String(
      idOf(
        await (
          await request(
            `/api/rolls/${rollId}/frames/${frame}/versions?file=${name}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'image/jpeg' },
              body: new Uint8Array(await aJpeg({ shade: 40 + index * 120 })),
            },
          )
        ).json(),
      ),
    );
    images.push(
      path.join(
        await folderOfRoll(archive.path(), '2026-014'),
        'frames',
        `unnumbered-${frame.slice(-8)}`,
        `scan-${version.slice(-8)}`,
        name,
      ),
    );
  }
  const folder = await folderOfRoll(archive.path(), '2026-014');
  return { images, rollJson: path.join(folder, 'roll.json') };
}

async function writable(file: string) {
  await chmod(file, 0o644);
}

async function isReadOnly(file: string): Promise<boolean> {
  return ((await stat(file)).mode & 0o222) === 0;
}

let errors = new InMemoryErrorReporter();

beforeEach(() => {
  errors = new InMemoryErrorReporter();
});

describe('localStartup (FF-109)', () => {
  test('makes the images already in the library read-only, says so once, and has nothing to say the next time', async () => {
    const { images } = await aLibraryWithImages();
    for (const image of images) {
      await writable(image);
    }
    const said: string[] = [];

    await localStartup(
      { archivePath: archive.path() },
      (m) => said.push(m),
      errors,
    );

    expect(await Promise.all(images.map(isReadOnly))).toEqual([true, true]);
    expect(said).toEqual(['Made 2 originals read-only.']);

    await localStartup(
      { archivePath: archive.path() },
      (m) => said.push(m),
      errors,
    );
    expect(said).toHaveLength(1);
  });

  test('leaves roll.json, other files and the deleted folder, and the images’ contents, alone', async () => {
    const { images, rollJson } = await aLibraryWithImages();
    for (const image of images) {
      await writable(image);
    }
    const before = await readFile(rollJson);
    await chmod(rollJson, 0o644);
    const held = path.join(archive.path(), 'deleted', 'frame-1', 'scan.jpg');
    await mkdir(path.dirname(held), { recursive: true });
    await writeFile(held, 'held');
    const sidecar = path.join(path.dirname(images[0] ?? ''), 'recipe.negpy');
    await writeFile(sidecar, '{}');
    const content = await readFile(images[0] ?? '');

    await localStartup(
      { archivePath: archive.path() },
      () => undefined,
      errors,
    );

    expect(await isReadOnly(rollJson)).toBe(false);
    expect(await readFile(rollJson)).toEqual(before);
    expect(await isReadOnly(held)).toBe(false);
    expect(await isReadOnly(sidecar)).toBe(false);
    expect(await readFile(images[0] ?? '')).toEqual(content);
  });

  test('counts an image that is missing as one it couldn’t change, and goes on', async () => {
    const { images } = await aLibraryWithImages();
    for (const image of images) {
      await writable(image);
    }
    await rm(images[0] ?? '');
    const said: string[] = [];

    await localStartup(
      { archivePath: archive.path() },
      (m) => said.push(m),
      errors,
    );

    expect(said).toEqual(["Made 1 original read-only; 1 couldn't be changed."]);
    expect(await isReadOnly(images[1] ?? '')).toBe(true);
  });

  test('says nothing, and does not fail, for an archive with nothing in it', async () => {
    const said: string[] = [];

    await localStartup(
      { archivePath: archive.path() },
      (m) => said.push(m),
      errors,
    );

    expect(said).toEqual([]);
    expect(errors.reported).toEqual([]);
  });

  test('reports a failure to make originals read-only once, and still finishes (FF-203)', async () => {
    // A roll.json that's a folder can't be read, so listing the rolls throws.
    await mkdir(
      path.join(
        archive.path(),
        'rolls',
        '2026',
        '2026-099-ABCDEFGH',
        'roll.json',
      ),
      { recursive: true },
    );
    const said: string[] = [];

    await localStartup(
      { archivePath: archive.path() },
      (m) => said.push(m),
      errors,
    );

    expect(said).toEqual([]);
    expect(errors.reported.map(({ what }) => what)).toEqual([
      "Couldn't make originals read-only",
    ]);
    expect(errors.reported[0]?.error).toBeInstanceOf(Error);
  });

  test('stores each new image read-only, so there is nothing to change on the next start', async () => {
    const { images } = await aLibraryWithImages();
    const said: string[] = [];

    await localStartup(
      { archivePath: archive.path() },
      (m) => said.push(m),
      errors,
    );

    expect(await Promise.all(images.map(isReadOnly))).toEqual([true, true]);
    expect(said).toEqual([]);
  });
});
