import { beforeEach, describe, expect, test } from 'vitest';
import {
  InMemoryExportDestination,
  InMemoryExportFolder,
} from '../../src/adapters/outbound/memory/in-memory-export-destination.ts';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();

/** A folder whose second write waits until it's let go, so a test can cancel while a file is in progress. */
class GatedFolder extends InMemoryExportFolder {
  release: () => void = () => undefined;
  /** Resolves once the second write has begun and is waiting. */
  secondBegun: () => void = () => undefined;
  readonly waiting = new Promise<void>((resolve) => {
    this.secondBegun = resolve;
  });
  #writes = 0;
  readonly #gate = new Promise<void>((resolve) => {
    this.release = resolve;
  });

  override async write(path: string, bytes: Uint8Array): Promise<string> {
    this.#writes += 1;
    if (this.#writes === 2) {
      this.secondBegun();
      await this.#gate;
    }
    return await super.write(path, bytes);
  }
}

let folder = new InMemoryExportFolder();
let destination = new InMemoryExportDestination(folder);
let rollId = '';
let shades = 0;

// One service for each destination in a test, since its exports live in it.
const services = new Map<
  InMemoryExportDestination,
  ReturnType<typeof apiFor>
>();

function api(chosen: InMemoryExportDestination = destination) {
  let service = services.get(chosen);
  if (service === undefined) {
    service = apiFor(archive, { destination: chosen });
    services.set(chosen, service);
  }
  return service;
}

beforeEach(async () => {
  folder = new InMemoryExportFolder('/Users/ben/Pictures/Iceland');
  destination = new InMemoryExportDestination(folder);
  services.clear();
  const { post } = api();
  await post('/api/settings', { author: 'Ben Pirt' });
  rollId = String(
    idOf(
      await (
        await post('/api/rolls', { roll: '2026-014', shot: '2026' })
      ).json(),
    ),
  );
});

async function aFrame(number: string, withScan = true) {
  const { request, post } = api();
  const frameId = String(
    idOf(await (await post(`/api/rolls/${rollId}/frames`, { number })).json()),
  );
  if (withScan) {
    shades += 20;
    await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions?file=${number}.jpg`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: new Uint8Array(await aJpeg({ shade: shades })),
      },
    );
  }
  return { rollId, frameId };
}

function startExport(
  frames: { rollId: string; frameId: string }[],
  change: object = {},
) {
  return api().post('/api/exports/folder', {
    frames,
    layout: 'flat',
    fileNames: '{roll}-{frame}',
    size: 300,
    quality: 80,
    metadata: 'author-and-copyright',
    ...change,
  });
}

async function jobOf(response: Response): Promise<string> {
  const body: unknown = await response.json();
  return typeof body === 'object' &&
    body !== null &&
    'job' in body &&
    typeof body.job === 'string'
    ? body.job
    : '';
}

/** The export's status once it's no longer running. */
async function finished(job: string) {
  for (let tries = 0; tries < 200; tries += 1) {
    const status: unknown = await (
      await api().request(`/api/exports/folder/${job}`)
    ).json();
    if (
      typeof status === 'object' &&
      status !== null &&
      'state' in status &&
      status.state !== 'running'
    ) {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('the export did not finish');
}

describe('exporting several frames into a folder', () => {
  test('says whether the service has a desktop app to ask', async () => {
    const without = apiFor(archive);

    expect(await (await without.request('/api/health')).json()).toMatchObject({
      exportToFolder: false,
    });
    expect(await (await api().request('/api/health')).json()).toMatchObject({
      exportToFolder: true,
    });
  });

  test('writes a JPEG of each frame into the chosen folder as the layout and names say, and tells the app', async () => {
    const frames = [await aFrame('1'), await aFrame('2')];

    const started = await startExport(frames, { layout: 'roll-folder' });
    const status = await finished(await jobOf(started));

    expect(started.status).toBe(200);
    expect(status).toEqual({
      state: 'done',
      done: 2,
      total: 2,
      written: 2,
      leftOut: 0,
    });
    expect([...folder.files.keys()]).toEqual([
      '2026-014/2026-014-1.jpg',
      '2026-014/2026-014-2.jpg',
    ]);
    expect(destination.finishedWith).toEqual([
      { folder: '/Users/ben/Pictures/Iceland', written: 2, leftOut: 0 },
    ]);
  });

  test('numbers a file that is already in the folder, and replaces nothing', async () => {
    await folder.write('2026-014-1.jpg', new TextEncoder().encode('earlier'));
    const frames = [await aFrame('1')];

    await finished(await jobOf(await startExport(frames)));

    expect([...folder.files.keys()]).toEqual([
      '2026-014-1.jpg',
      '2026-014-1-2.jpg',
    ]);
    expect(new TextDecoder().decode(folder.files.get('2026-014-1.jpg'))).toBe(
      'earlier',
    );
  });

  test('leaves out a frame it cannot make, listing it in skipped.txt and saying how many', async () => {
    const frames = [await aFrame('1'), await aFrame('2', false)];

    const status = await finished(await jobOf(await startExport(frames)));

    expect(status).toMatchObject({ state: 'done', written: 1, leftOut: 1 });
    expect([...folder.files.keys()]).toEqual(['2026-014-1.jpg', 'skipped.txt']);
    expect(new TextDecoder().decode(folder.files.get('skipped.txt'))).toContain(
      'frame 2 of roll 2026-014: it has no scan',
    );
    expect(destination.finishedWith).toEqual([
      { folder: '/Users/ben/Pictures/Iceland', written: 1, leftOut: 1 },
    ]);
  });

  test('writes nothing when the person cancels the folder chooser', async () => {
    const cancelling = new InMemoryExportDestination(undefined);
    const frames = [await aFrame('1')];

    const response = await api(cancelling).post('/api/exports/folder', {
      frames,
      layout: 'flat',
      fileNames: '{roll}-{frame}',
      size: null,
      quality: 90,
      metadata: 'everything',
    });

    expect(await response.json()).toEqual({ job: null });
    expect(folder.files.size).toBe(0);
    expect(cancelling.finishedWith).toEqual([]);
  });

  test('stops after the file in progress when cancelled, keeping what is written', async () => {
    const gated = new GatedFolder('/Users/ben/Pictures/Iceland');
    const gatedDestination = new InMemoryExportDestination(gated);
    const frames = [await aFrame('1'), await aFrame('2'), await aFrame('3')];
    const response = await api(gatedDestination).post('/api/exports/folder', {
      frames,
      layout: 'flat',
      fileNames: '{roll}-{frame}',
      size: 300,
      quality: 80,
      metadata: 'author-and-copyright',
    });
    const job = await jobOf(response);
    await gated.waiting;

    const cancel = await api(gatedDestination).request(
      `/api/exports/folder/${job}`,
      { method: 'DELETE' },
    );
    gated.release();
    const status = await (async () => {
      for (let tries = 0; tries < 200; tries += 1) {
        const now: unknown = await (
          await api(gatedDestination).request(`/api/exports/folder/${job}`)
        ).json();
        if (
          typeof now === 'object' &&
          now !== null &&
          'state' in now &&
          now.state !== 'running'
        ) {
          return now;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return undefined;
    })();

    expect(cancel.status).toBe(204);
    expect(status).toMatchObject({ state: 'cancelled', written: 2 });
    expect([...gated.files.keys()]).toEqual([
      '2026-014-1.jpg',
      '2026-014-2.jpg',
    ]);
  });

  test('is refused when the service has no desktop app to ask', async () => {
    const frames = [await aFrame('1')];
    const response = await apiFor(archive).post('/api/exports/folder', {
      frames,
      layout: 'flat',
      fileNames: '{roll}-{frame}',
      size: null,
      quality: 90,
      metadata: 'everything',
    });

    expect(response.status).toBe(422);
  });

  test('refuses a pattern that is not a placeholder, a frame that is not there, and an export that is not there', async () => {
    const frames = [await aFrame('1')];

    expect((await startExport(frames, { fileNames: '{rol}' })).status).toBe(
      422,
    );
    expect(
      (await startExport([{ rollId, frameId: '01JC8Z7K3M0000000000000009' }]))
        .status,
    ).toBe(404);
    expect((await api().request('/api/exports/folder/999')).status).toBe(404);
    expect(
      (await api().request('/api/exports/folder/999', { method: 'DELETE' }))
        .status,
    ).toBe(404);
  });
});
