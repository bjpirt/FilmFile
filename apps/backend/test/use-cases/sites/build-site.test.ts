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
  intro: '',
  groupBy: 'nothing',
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

describe('BuildSite', () => {
  test('writes the page, its assets, the manifest and an image at each size for every frame', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    const two = await archive.addFrame(2);

    const built = await archive.build([one, two]);

    expect(built).toEqual({
      ok: true,
      value: { photos: 2, leftOut: 0, imagesMade: 6, imagesUnchanged: 0 },
    });
    const files = archive.folders.sites.get(slug)?.files;
    expect(
      [...(files?.keys() ?? [])].filter((p) => !p.startsWith('images/')),
    ).toEqual(['index.html', 'assets/site.css', 'assets/site.js', 'site.json']);
    expect(
      [...(files?.keys() ?? [])].filter((p) => p.startsWith('images/')),
    ).toHaveLength(6);
    expect(text(files?.get('index.html'))).toContain('Roll 2026-014, frame 2');
  });

  test('builds a site that is up to date again without touching it', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1);
    await archive.build([one]);
    const before = archive.folders.sites.get(slug);

    const again = await archive.build([one]);

    expect(again).toEqual({
      ok: true,
      value: { photos: 1, leftOut: 0, imagesMade: 0, imagesUnchanged: 3 },
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
      value: { photos: 2, leftOut: 0, imagesMade: 3, imagesUnchanged: 3 },
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
    expect(images).toHaveLength(3);
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
    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(image).toContain('saying {}');
    }
  });

  test('shows a frame’s title in the page when captions ask for it', async () => {
    const archive = anArchive();
    const one = await archive.addFrame(1, { title: 'Black beach' });

    await archive.build([one]);

    expect(
      text(archive.folders.sites.get(slug)?.files.get('index.html')),
    ).toContain('<figcaption>Black beach</figcaption>');
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

    expect(told).toEqual(['1 of 3', '2 of 3', '3 of 3']);
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
