import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { FilesystemSiteFolders } from '../../src/adapters/outbound/filesystem/filesystem-site-folders.ts';
import { InMemorySiteFolders } from '../../src/adapters/outbound/memory/in-memory-site-folders.ts';
import { ctx } from '../support/builders.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { siteFoldersContract } from './site-folders-contract.ts';
import { isSlug } from '../../src/domain/shared/slug.ts';
import { checked } from '../support/checked.ts';

const archive = useTempArchive();

siteFoldersContract('InMemorySiteFolders', () => {
  const folders = new InMemorySiteFolders();
  return {
    folders,
    read: (slug, file) => {
      const found = folders.sites.get(slug)?.files.get(file);
      return Promise.resolve(
        found === undefined
          ? undefined
          : new TextDecoder().decode(
              typeof found === 'string'
                ? new TextEncoder().encode(found)
                : found,
            ),
      );
    },
    putSomethingElse: (slug) => {
      folders.sites.set(slug, {
        files: new Map([['notes.txt', 'mine']]),
        manifest: undefined,
      });
      return Promise.resolve();
    },
  };
});

siteFoldersContract('FilesystemSiteFolders', () => ({
  folders: new FilesystemSiteFolders(archive.folder()),
  read: async (slug, file) => {
    try {
      return await readFile(
        path.join(archive.folder(), 'Sites', slug, ...file.split('/')),
        'utf8',
      );
    } catch {
      return undefined;
    }
  },
  putSomethingElse: async (slug) => {
    const folder = path.join(archive.folder(), 'Sites', slug);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'notes.txt'), 'mine');
  },
}));

const slug = checked('iceland', isSlug);

test('FilesystemSiteFolders says a site.json that is not a site’s is in the way, and leaves it', async () => {
  const folder = path.join(archive.folder(), 'Sites', slug);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'site.json'), '{"hello":"world"}');

  const state = await new FilesystemSiteFolders(archive.folder()).inspect(
    ctx,
    slug,
  );

  expect(state).toEqual({ kind: 'in-the-way' });
  expect(await readFile(path.join(folder, 'site.json'), 'utf8')).toBe(
    '{"hello":"world"}',
  );
});

test('FilesystemSiteFolders leaves nothing but the site in Sites/ after a build, and keeps other folders', async () => {
  const sites = path.join(archive.folder(), 'Sites');
  await mkdir(path.join(sites, 'other'), { recursive: true });
  const folders = new FilesystemSiteFolders(archive.folder());

  const build = await folders.begin(ctx, slug);
  await build.writeFile('index.html', 'x');
  await build.commit({
    version: 1,
    options: { title: 't', intro: '', groupBy: 'nothing', captions: [] },
    photos: [],
  });

  expect((await readdir(sites)).sort()).toEqual(['iceland', 'other']);
});
