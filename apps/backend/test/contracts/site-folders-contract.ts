import { describe, expect, test } from 'vitest';
import type { SiteFolders } from '../../src/application/ports/site-folders.ts';
import { isFrameId } from '../../src/domain/shared/ids.ts';
import { isSlug } from '../../src/domain/shared/slug.ts';
import type { SiteManifest } from '../../src/domain/sites/site-manifest.ts';
import { ctx } from '../support/builders.ts';
import { checked } from '../support/checked.ts';

const slug = checked('iceland', isSlug);

const manifest: SiteManifest = {
  version: 1,
  options: {
    title: 'Iceland',
    groupBy: 'event',
    captions: ['title', 'shot'],
  },
  photos: [
    {
      frame: checked('01JD8M2KZXQ4T6V8W0Y1A3C5E7', isFrameId),
      alt: 'Roll 2026-014, frame 1',
      images: [{ src: 'images/a.jpg', width: 480, madeFrom: 'abc' }],
      width: 480,
      height: 320,
      roll: { key: 'r', heading: '2026-014' },
      event: { key: 'iceland', heading: 'Iceland', detail: '2026' },
      details: { title: 'Black beach', shot: '12 Sep 2026' },
    },
  ],
};

/** What every SiteFolders must do, run against each adapter. */
export function siteFoldersContract(
  name: string,
  make: () => {
    readonly folders: SiteFolders;
    /** A file of a built site, by path; undefined if there isn't one. */
    readonly read: (slug: string, path: string) => Promise<string | undefined>;
    /** Puts files in `Sites/<slug>/` that aren't a built site. */
    readonly putSomethingElse: (slug: string) => Promise<void>;
  },
): void {
  describe(`${name} meets the SiteFolders contract`, () => {
    const bytes = (text: string) => new TextEncoder().encode(text);

    test('has nothing for a site never built', async () => {
      const { folders } = make();

      expect(await folders.inspect(ctx, slug)).toEqual({ kind: 'empty' });
    });

    test('a committed build is the built site, with its manifest and files', async () => {
      const { folders, read } = make();

      const build = await folders.begin(ctx, slug);
      await build.writeFile('index.html', '<p>hi</p>');
      await build.writeImage('images/a.jpg', bytes('jpeg a'));
      await build.commit(manifest);

      expect(await folders.inspect(ctx, slug)).toEqual({
        kind: 'built',
        manifest,
      });
      expect(await read(slug, 'index.html')).toBe('<p>hi</p>');
      expect(await read(slug, 'images/a.jpg')).toBe('jpeg a');
      expect(await read(slug, 'site.json')).toContain('"title": "Iceland"');
    });

    test('keeps an image the built site has, and says so for one it hasn’t', async () => {
      const { folders, read } = make();
      const first = await folders.begin(ctx, slug);
      await first.writeImage('images/a.jpg', bytes('jpeg a'));
      await first.commit(manifest);

      const second = await folders.begin(ctx, slug);
      const kept = await second.keep('images/a.jpg');
      const missing = await second.keep('images/b.jpg');
      await second.commit(manifest);

      expect([kept, missing]).toEqual([true, false]);
      expect(await read(slug, 'images/a.jpg')).toBe('jpeg a');
    });

    test('a build replaces the site whole: what it did not bring across is gone', async () => {
      const { folders, read } = make();
      const first = await folders.begin(ctx, slug);
      await first.writeImage('images/old.jpg', bytes('old'));
      await first.commit(manifest);

      const second = await folders.begin(ctx, slug);
      await second.writeImage('images/new.jpg', bytes('new'));
      await second.commit(manifest);

      expect(await read(slug, 'images/old.jpg')).toBeUndefined();
      expect(await read(slug, 'images/new.jpg')).toBe('new');
    });

    test('leaves the built site as it was until the build is committed, and after it is discarded', async () => {
      const { folders, read } = make();
      const first = await folders.begin(ctx, slug);
      await first.writeImage('images/a.jpg', bytes('jpeg a'));
      await first.commit(manifest);

      const second = await folders.begin(ctx, slug);
      await second.writeImage('images/b.jpg', bytes('jpeg b'));
      expect(await read(slug, 'images/b.jpg')).toBeUndefined();
      await second.discard();

      expect(await folders.inspect(ctx, slug)).toEqual({
        kind: 'built',
        manifest,
      });
      expect(await read(slug, 'images/a.jpg')).toBe('jpeg a');
      expect(await read(slug, 'images/b.jpg')).toBeUndefined();
    });

    test('reads a file of the built site, and says there is none that is not', async () => {
      const { folders } = make();
      const build = await folders.begin(ctx, slug);
      await build.writeFile('assets/site.css', 'p {}');
      await build.writeImage('images/a.jpg', bytes('jpeg a'));
      await build.commit(manifest);

      expect(
        new TextDecoder().decode(
          await folders.read(ctx, slug, 'assets/site.css'),
        ),
      ).toBe('p {}');
      expect(await folders.read(ctx, slug, 'images/a.jpg')).toEqual(
        bytes('jpeg a'),
      );
      expect(await folders.read(ctx, slug, 'images/none.jpg')).toBeUndefined();
      expect(await folders.read(ctx, slug, 'images')).toBeUndefined();
      expect(
        await folders.read(ctx, checked('other', isSlug), 'index.html'),
      ).toBeUndefined();
    });

    test('refuses to read a path that would leave the site’s folder', async () => {
      const { folders } = make();

      await expect(folders.read(ctx, slug, '../x')).rejects.toThrow();
      await expect(folders.read(ctx, slug, 'a/../../x')).rejects.toThrow();
    });

    test('says a folder holding something else is in the way', async () => {
      const { folders, putSomethingElse } = make();
      await putSomethingElse(slug);

      expect(await folders.inspect(ctx, slug)).toEqual({ kind: 'in-the-way' });
    });

    test('refuses a path that would leave the site’s folder', async () => {
      const { folders } = make();
      const build = await folders.begin(ctx, slug);

      await expect(build.writeFile('../outside.txt', 'x')).rejects.toThrow();
      await expect(
        build.writeImage('a/../../b.jpg', bytes('x')),
      ).rejects.toThrow();
      await build.discard();
    });
  });
}
