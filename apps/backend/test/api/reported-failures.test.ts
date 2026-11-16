import { beforeEach, describe, expect, test } from 'vitest';
import { siteStatus } from '@filmfile/contracts/sites';
import {
  InMemoryExportDestination,
  InMemoryExportFolder,
} from '../../src/adapters/outbound/memory/in-memory-export-destination.ts';
import { InMemoryErrorReporter } from '../../src/adapters/outbound/memory/in-memory-error-reporter.ts';
import { InMemoryImageRenderer } from '../../src/adapters/outbound/memory/in-memory-image-renderer.ts';
import type { ImageRenderer } from '../../src/application/ports/image-renderer.ts';
import { composeInMemory } from '../../src/composition/compose-in-memory.ts';
import { aJpeg } from '../support/a-jpeg.ts';
import { idOf, origin } from '../support/api.ts';
import { readZip } from '../support/read-zip.ts';

// Unexpected failures in background work are reported to the log, while the
// page is told no more than before (FF-203, D113).

/** A renderer that can't make anything, as a bug or a broken image would. */
class BrokenRenderer implements ImageRenderer {
  readonly failure = new Error('the renderer broke');

  render(): Promise<Uint8Array> {
    return Promise.reject(this.failure);
  }
}

/** A folder that refuses every write, as a full or removed drive would. */
class RefusingFolder extends InMemoryExportFolder {
  readonly failure = new Error('the drive is full');

  override write(): Promise<string> {
    return Promise.reject(this.failure);
  }
}

/** A folder whose first write waits until it's let go, so a test can cancel while it's in progress. */
class HeldFolder extends InMemoryExportFolder {
  readonly #begun = Promise.withResolvers<undefined>();
  readonly #released = Promise.withResolvers<undefined>();
  /** Resolves once the first write has begun and is waiting. */
  readonly writing = this.#begun.promise;

  release(): void {
    this.#released.resolve(undefined);
  }

  override async write(path: string, bytes: Uint8Array): Promise<string> {
    this.#begun.resolve(undefined);
    await this.#released.promise;
    return await super.write(path, bytes);
  }
}

let errors = new InMemoryErrorReporter();

beforeEach(() => {
  errors = new InMemoryErrorReporter();
});

/** The service in memory, reporting to `errors`, with the renderer and folder given. */
function serviceWith(
  options: {
    readonly renderer?: ImageRenderer;
    readonly folder?: InMemoryExportFolder;
  } = {},
) {
  const destination = new InMemoryExportDestination(
    options.folder ?? new InMemoryExportFolder(),
  );
  const app = composeInMemory({
    errors,
    destination,
    renderer: options.renderer ?? new InMemoryImageRenderer(),
  });
  const request = (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('Origin', origin);
    return Promise.resolve(
      app.request(`${origin}${url}`, { ...init, headers }),
    );
  };
  const post = (url: string, body: unknown) =>
    request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { request, post };
}

type Service = ReturnType<typeof serviceWith>;

/** A roll, 2026-014, with a frame for each number, each with its own scan. */
async function aRollWithScans(
  { request, post }: Service,
  numbers: readonly string[],
) {
  const rollId = String(
    idOf(
      await (
        await post('/api/rolls', { roll: '2026-014', shot: '2026' })
      ).json(),
    ),
  );
  const frames: { rollId: string; frameId: string }[] = [];
  for (const [index, number] of numbers.entries()) {
    const frameId = String(
      idOf(
        await (await post(`/api/rolls/${rollId}/frames`, { number })).json(),
      ),
    );
    await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions?file=${number}.jpg`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: new Uint8Array(await aJpeg({ shade: 20 + index * 40 })),
      },
    );
    frames.push({ rollId, frameId });
  }
  return frames;
}

async function hide(
  { request }: Service,
  frame: { rollId: string; frameId: string },
) {
  const etag =
    (await request(`/api/rolls/${frame.rollId}`)).headers.get('ETag') ?? '';
  await request(`/api/rolls/${frame.rollId}/frames/${frame.frameId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify({ hidden: true }),
  });
}

const recipe = {
  layout: 'flat',
  fileNames: '{roll}-{frame}',
  size: 300,
  quality: 80,
  metadata: 'author-and-copyright',
};

/** Builds the site "Iceland" of every frame, and gives its finished build. */
async function buildASite({ request, post }: Service) {
  await post('/api/sites', { name: 'Iceland' });
  expect((await post('/api/sites/iceland/build', {})).status).toBe(202);
  for (let tries = 0; tries < 200; tries += 1) {
    const status = siteStatus.parse(
      await (await request('/api/sites/iceland/status')).json(),
    );
    if (status.build !== null && status.build.state !== 'running') {
      return status.build;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('the build did not finish');
}

/** Downloads the frames as a zip, and gives the files in it. */
async function zipOf(
  { request, post }: Service,
  frames: { rollId: string; frameId: string }[],
) {
  const prepared: unknown = await (
    await post('/api/exports/quick', { frames, output: 'zip', ...recipe })
  ).json();
  const url =
    typeof prepared === 'object' && prepared !== null && 'url' in prepared
      ? String(prepared.url)
      : '';
  return readZip(new Uint8Array(await (await request(url)).arrayBuffer()));
}

/**
 * Exports the frames to the service's folder, and gives the finished export's
 * status; `meanwhile` is done with the export's address while it runs.
 */
async function exportToFolder(
  { request, post }: Service,
  frames: { rollId: string; frameId: string }[],
  meanwhile: (address: string) => Promise<void> = () => Promise.resolve(),
) {
  const started: unknown = await (
    await post('/api/exports/folder', { frames, ...recipe })
  ).json();
  const job =
    typeof started === 'object' && started !== null && 'job' in started
      ? String(started.job)
      : '';
  await meanwhile(`/api/exports/folder/${job}`);
  for (let tries = 0; tries < 200; tries += 1) {
    const status: unknown = await (
      await request(`/api/exports/folder/${job}`)
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

describe('a site build', () => {
  test('that breaks is marked failed, and reported once, naming the site', async () => {
    const renderer = new BrokenRenderer();
    const service = serviceWith({ renderer });
    await aRollWithScans(service, ['1', '2']);

    const build = await buildASite(service);

    expect(build).toMatchObject({ state: 'failed' });
    expect(errors.reported).toEqual([
      { what: "Couldn't build site iceland", error: renderer.failure },
    ]);
  });

  test('that works reports nothing', async () => {
    const service = serviceWith();
    await aRollWithScans(service, ['1']);

    expect(await buildASite(service)).toMatchObject({ state: 'done' });
    expect(errors.reported).toEqual([]);
  });
});

describe('a zip download', () => {
  test('lists a frame that breaks in skipped.txt as before, and reports each one, naming it', async () => {
    const renderer = new BrokenRenderer();
    const service = serviceWith({ renderer });
    const frames = await aRollWithScans(service, ['1', '2']);

    const files = await zipOf(service, frames);

    expect(files.map((file) => file.name)).toEqual(['skipped.txt']);
    expect(files[0]?.data.toString()).toBe(
      "These frames were left out:\n- frame 1 of roll 2026-014: its image couldn't be made\n- frame 2 of roll 2026-014: its image couldn't be made\n",
    );
    expect(errors.reported).toEqual([
      {
        what: "Couldn't make frame 1 of roll 2026-014",
        error: renderer.failure,
      },
      {
        what: "Couldn't make frame 2 of roll 2026-014",
        error: renderer.failure,
      },
    ]);
  });

  test('reports nothing for a frame left out for a reason it gives, such as being hidden', async () => {
    const service = serviceWith();
    const frames = await aRollWithScans(service, ['1', '2']);
    const [, second] = frames;
    if (second !== undefined) {
      await hide(service, second);
    }

    const files = await zipOf(service, frames);

    expect(files.map((file) => file.name)).toEqual([
      '2026-014-1.jpg',
      'skipped.txt',
    ]);
    expect(errors.reported).toEqual([]);
  });
});

describe('an export to a folder', () => {
  test('lists a frame that breaks in skipped.txt and finishes, reporting each one', async () => {
    const renderer = new BrokenRenderer();
    const folder = new InMemoryExportFolder();
    const service = serviceWith({ renderer, folder });
    const frames = await aRollWithScans(service, ['1']);

    const status = await exportToFolder(service, frames);

    expect(status).toMatchObject({ state: 'done', written: 0, leftOut: 1 });
    expect([...folder.files.keys()]).toEqual(['skipped.txt']);
    expect(errors.reported).toEqual([
      {
        what: "Couldn't make frame 1 of roll 2026-014",
        error: renderer.failure,
      },
    ]);
  });

  test('that stops because a file can’t be written is marked failed, and reported once', async () => {
    const folder = new RefusingFolder();
    const service = serviceWith({ folder });
    const frames = await aRollWithScans(service, ['1', '2']);

    const status = await exportToFolder(service, frames);

    expect(status).toMatchObject({ state: 'failed' });
    expect(errors.reported).toEqual([
      { what: "Couldn't finish an export to a folder", error: folder.failure },
    ]);
  });

  test('that is cancelled reports nothing', async () => {
    const folder = new HeldFolder();
    const service = serviceWith({ folder });
    const frames = await aRollWithScans(service, ['1', '2']);

    const status = await exportToFolder(service, frames, async (address) => {
      await folder.writing;
      await service.request(address, { method: 'DELETE' });
      folder.release();
    });

    expect(status).toMatchObject({ state: 'cancelled', written: 1 });
    expect(errors.reported).toEqual([]);
  });

  test('that works reports nothing', async () => {
    const service = serviceWith();
    const frames = await aRollWithScans(service, ['1', '2']);

    expect(await exportToFolder(service, frames)).toMatchObject({
      state: 'done',
      written: 2,
    });
    expect(errors.reported).toEqual([]);
  });
});
