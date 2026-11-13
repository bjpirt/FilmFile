import { describe, expect, test } from 'vitest';
import { InMemoryBlobStore } from '../../../src/adapters/outbound/memory/in-memory-blob-store.ts';
import { InMemoryEquipmentRepository } from '../../../src/adapters/outbound/memory/in-memory-equipment-repository.ts';
import { InMemoryEventRepository } from '../../../src/adapters/outbound/memory/in-memory-event-repository.ts';
import { InMemoryImageRenderer } from '../../../src/adapters/outbound/memory/in-memory-image-renderer.ts';
import { InMemoryRollRepository } from '../../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { InMemorySettingsRepository } from '../../../src/adapters/outbound/memory/in-memory-settings-repository.ts';
import { InMemorySiteFolders } from '../../../src/adapters/outbound/memory/in-memory-site-folders.ts';
import {
  BuildSite,
  type BuildSiteInput,
} from '../../../src/application/use-cases/sites/build-site.ts';
import type { Frame } from '../../../src/domain/rolls/roll.ts';
import { ok } from '../../../src/domain/shared/result.ts';
import { isSlug } from '../../../src/domain/shared/slug.ts';
import type { SiteOptions } from '../../../src/domain/sites/site-options.ts';
import {
  aFrame,
  aRoll,
  aVersion,
  ctx,
  ulidFor,
} from '../../support/builders.ts';
import { checked } from '../../support/checked.ts';

const slug = checked('iceland-highlights', isSlug);
const options: SiteOptions = {
  title: 'Iceland highlights',
  captions: ['title'],
};

/** Everything a site is built from, in memory. */
function anArchive() {
  const rolls = new InMemoryRollRepository();
  const blobs = new InMemoryBlobStore();
  const folders = new InMemorySiteFolders();
  const build = new BuildSite(
    rolls,
    new InMemorySettingsRepository(),
    new InMemoryEquipmentRepository(),
    new InMemoryEventRepository(),
    blobs,
    new InMemoryImageRenderer(),
    folders,
  );
  const roll = aRoll();
  return {
    rolls,
    folders,
    roll,
    /** Puts a frame with a large scan on the roll. */
    async addFrame(n: number, extra: Partial<Frame> = {}) {
      const frame: Frame = {
        ...aFrame({
          id: ulidFor(100 + n),
          number: String(n),
          versions: [],
        }),
        ...extra,
      };
      const version = {
        ...aVersion({ id: ulidFor(200 + n), sha256: String(n).repeat(64) }),
        width: 4000,
        height: 3000,
      };
      const file = await blobs.put(
        ctx,
        {
          rollId: roll.id,
          frameId: frame.id,
          frameNumber: frame.number,
          versionId: version.id,
          kind: 'scan',
          fileName: `scan-${String(n)}.jpg`,
        },
        new TextEncoder().encode(`scan ${String(n)}`),
      );
      const withScan: Frame = {
        ...frame,
        versions: [{ ...version, file }],
      };
      if ((await rolls.get(ctx, roll.id)) === undefined) {
        await rolls.create(ctx, { ...roll, frames: [withScan] });
      } else {
        await rolls.change(ctx, roll.id, (current) =>
          Promise.resolve(
            ok({
              roll: { ...current, frames: [...current.frames, withScan] },
              value: undefined,
            }),
          ),
        );
      }
      return withScan;
    },
    status: (input: Parameters<BuildSite['status']>[1]) =>
      build.status(ctx, input),
    build: (frames: readonly Frame[], over: Partial<BuildSiteInput> = {}) =>
      build.execute(ctx, {
        slug,
        frames: frames.map((frame) => ({
          rollId: roll.id,
          frameId: frame.id,
        })),
        options,
        ...over,
      }),
  };
}

function text(file: string | Uint8Array | undefined): string {
  return typeof file === 'string'
    ? file
    : new TextDecoder().decode(file ?? new Uint8Array());
}

/** The text of the built site's one roll page. */
function rollPage(
  files: ReadonlyMap<string, string | Uint8Array> | undefined,
): string {
  const path = [...(files?.keys() ?? [])].find((p) =>
    /^rolls\/[^/]+\.html$/.test(p),
  );
  return path === undefined ? '' : text(files?.get(path));
}

/** The text of the built site's first frame page, under its one roll. */
function framePage(
  files: ReadonlyMap<string, string | Uint8Array> | undefined,
): string {
  const path = [...(files?.keys() ?? [])].find((p) =>
    /^rolls\/[^/]+\/[^/]+\.html$/.test(p),
  );
  return path === undefined ? '' : text(files?.get(path));
}

describe('BuildSite', () => {
  test('writes the pages, its assets, the manifest and an image at each size for every frame', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    const two = await archive.addFrame(2);

    const built = await archive.build([one, two]);

    expect(built).toEqual({
      ok: true,
      value: { photos: 2, leftOut: 0, imagesMade: 8, imagesUnchanged: 0 },
    });
    const files = archive.folders.sites.get(slug)?.files;
    const paths = [...(files?.keys() ?? [])];
    expect(paths.filter((p) => !p.startsWith('images/'))).toEqual([
      'index.html',
      'events/_no-event.html',
      expect.stringMatching(/^events\/_no-event\/1-[0-9A-Z]{8}\.html$/),
      expect.stringMatching(/^events\/_no-event\/2-[0-9A-Z]{8}\.html$/),
      expect.stringMatching(/^rolls\/2026-014-[0-9A-Z]{8}\.html$/),
      expect.stringMatching(
        /^rolls\/2026-014-[0-9A-Z]{8}\/1-[0-9A-Z]{8}\.html$/,
      ),
      expect.stringMatching(
        /^rolls\/2026-014-[0-9A-Z]{8}\/2-[0-9A-Z]{8}\.html$/,
      ),
      'assets/site.css',
      'assets/site.js',
      'site.json',
    ]);
    expect(paths.filter((p) => p.startsWith('images/'))).toHaveLength(8);
    expect(rollPage(files)).toContain('Roll 2026-014, frame 2');
  });

  test('builds a site that is up to date again without touching it', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    await archive.build([one]);
    const before = archive.folders.sites.get(slug);

    const again = await archive.build([one]);

    expect(again).toEqual({
      ok: true,
      value: { photos: 1, leftOut: 0, imagesMade: 0, imagesUnchanged: 4 },
    });
    expect(archive.folders.sites.get(slug)).toBe(before);
  });

  test('makes only the images of a frame added since', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    const two = await archive.addFrame(2);
    await archive.build([one]);

    const built = await archive.build([one, two]);

    expect(built).toEqual({
      ok: true,
      value: { photos: 2, leftOut: 0, imagesMade: 4, imagesUnchanged: 4 },
    });
  });

  test('takes away the images of a frame that is no longer on the site', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    const two = await archive.addFrame(2);
    await archive.build([one, two]);

    await archive.build([one]);

    const images = [
      ...(archive.folders.sites.get(slug)?.files.keys() ?? []),
    ].filter((path) => path.startsWith('images/'));
    expect(images).toHaveLength(4);
  });

  test('leaves out hidden frames and frames that are gone, and says how many', async () => {
    const archive = anArchive();
    const shown = await archive.addFrame(1);
    const hidden = await archive.addFrame(2, { hidden: true });
    const gone = { ...shown, id: aFrame({ id: ulidFor(999) }).id };

    const built = await archive.build([shown, hidden, gone]);

    expect(built).toMatchObject({ ok: true, value: { photos: 1, leftOut: 2 } });
    expect(
      text(archive.folders.sites.get(slug)?.files.get('index.html')),
    ).not.toContain('frame 2');
  });

  test('makes images that say only who they are by, never a title or notes', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1, {
      title: 'Black beach',
      notes: 'Secret spot',
    });

    await archive.build([one]);

    const images = [...(archive.folders.sites.get(slug)?.files ?? [])]
      .filter(([path]) => path.startsWith('images/'))
      .map(([, file]) => text(file));
    expect(images).toHaveLength(4);
    for (const image of images) {
      expect(image).toContain('saying {}');
    }
  });

  test('shows a frame’s title in the page when captions ask for it', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1, { title: 'Black beach' });

    await archive.build([one]);

    expect(framePage(archive.folders.sites.get(slug)?.files)).toContain(
      '<p class="caption">Black beach</p>',
    );
  });

  test('refuses to build over a folder that holds something else, changing nothing', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    const mine = new Map([['notes.txt', 'mine']]);
    archive.folders.sites.set(slug, { files: mine, manifest: undefined });

    const built = await archive.build([one]);

    expect(built).toEqual({
      ok: false,
      error: { kind: 'folder-in-the-way', slug },
    });
    expect(archive.folders.sites.get(slug)?.files).toBe(mine);
  });

  test('a cancelled build leaves the site as it was', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    const two = await archive.addFrame(2);
    await archive.build([one]);
    const before = archive.folders.sites.get(slug);
    const controller = new AbortController();

    const built = await archive.build([one, two], {
      signal: controller.signal,
      onProgress: () => {
        controller.abort();
      },
    });

    expect(built).toEqual({ ok: false, error: { kind: 'cancelled' } });
    expect(archive.folders.sites.get(slug)).toBe(before);
  });

  test('tells how far it has got after each image', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    const told: string[] = [];

    await archive.build([one], {
      onProgress: (done, total) =>
        told.push(`${String(done)} of ${String(total)}`),
    });

    expect(told).toEqual(['1 of 4', '2 of 4', '3 of 4', '4 of 4']);
  });

  test('builds an empty page for a site with no frames', async () => {
    const archive = anArchive();

    const built = await archive.build([]);

    expect(built).toMatchObject({ ok: true, value: { photos: 0 } });
    expect(
      text(archive.folders.sites.get(slug)?.files.get('index.html')),
    ).toContain('This site has no photos yet.');
  });
});

describe('BuildSite status', () => {
  test('says a site never built is not built, and one just built is up to date', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    const input = {
      slug,
      frames: [{ rollId: archive.roll.id, frameId: one.id }],
      options,
    };

    expect(await archive.status(input)).toEqual({ state: 'not-built' });
    await archive.build([one]);
    expect(await archive.status(input)).toEqual({ state: 'up-to-date' });
  });

  test('says a site is out of date once a frame is added, and nothing is written', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    const two = await archive.addFrame(2);
    await archive.build([one]);
    const before = archive.folders.sites.get(slug);

    const status = await archive.status({
      slug,
      frames: [one, two].map((frame) => ({
        rollId: archive.roll.id,
        frameId: frame.id,
      })),
      options,
    });

    expect(status).toMatchObject({
      state: 'out-of-date',
      changes: { added: [two.id] },
    });
    expect(archive.folders.sites.get(slug)).toBe(before);
  });

  test('says when a folder holding something else is in the way', async () => {
    const archive = anArchive();
    archive.folders.sites.set(slug, {
      files: new Map([['notes.txt', 'mine']]),
      manifest: undefined,
    });

    expect(await archive.status({ slug, frames: [], options })).toEqual({
      state: 'in-the-way',
    });
  });
});
