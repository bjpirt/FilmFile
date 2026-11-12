import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import type { SiteRepository } from '../../src/application/ports/site-repository.ts';
import { FilesystemSiteRepository } from '../../src/adapters/outbound/filesystem/filesystem-site-repository.ts';
import { InMemorySiteRepository } from '../../src/adapters/outbound/memory/in-memory-site-repository.ts';
import { defaultPresentation } from '../../src/domain/sites/site.ts';
import { isSiteId } from '../../src/domain/shared/ids.ts';
import { isSlug } from '../../src/domain/shared/slug.ts';
import { ctx } from '../support/builders.ts';
import { checked } from '../support/checked.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { siteRepositoryContract } from './site-repository-contract.ts';

const archive = useTempArchive();

siteRepositoryContract(
  'InMemorySiteRepository',
  () => new InMemorySiteRepository(),
);
siteRepositoryContract(
  'FilesystemSiteRepository',
  () => new FilesystemSiteRepository(archive.path()),
);

const site = {
  id: checked('01JD8M2KZXQ4T6V8W0Y1A3C5E7', isSiteId),
  slug: checked('iceland', isSlug),
  name: 'Iceland',
  selection: { rules: [], excluded: [] },
  presentation: defaultPresentation,
};

test('FilesystemSiteRepository writes the same bytes each time, and leaves them alone when nothing changed', async () => {
  const sites: SiteRepository = new FilesystemSiteRepository(archive.path());
  await sites.create(ctx, site);
  const file = path.join(archive.path(), 'sites', 'iceland.json');
  const before = await readFile(file, 'utf8');
  const read = await sites.get(ctx, site.slug);

  await sites.save(ctx, site, read?.version ?? '');

  expect(await readFile(file, 'utf8')).toBe(before);
  expect(JSON.parse(before)).toMatchObject({ schema: 1, name: 'Iceland' });
  expect(before.endsWith('}\n')).toBe(true);
});

test('FilesystemSiteRepository moves a removed site’s file to deleted/, never deleting it', async () => {
  const sites: SiteRepository = new FilesystemSiteRepository(archive.path());
  await sites.create(ctx, site);
  const before = await readFile(
    path.join(archive.path(), 'sites', 'iceland.json'),
    'utf8',
  );

  await sites.remove(ctx, site.slug, new Date('2026-11-02T12:00:00.000Z'));

  expect(await readdir(path.join(archive.path(), 'sites'))).toEqual([]);
  const held = path.join(
    archive.path(),
    'deleted',
    '2026-11-02T120000Z-site-iceland',
    'iceland.json',
  );
  expect(await readFile(held, 'utf8')).toBe(before);
});

test('FilesystemSiteRepository skips a file in sites/ that is not named as a slug', async () => {
  const sites: SiteRepository = new FilesystemSiteRepository(archive.path());
  await sites.create(ctx, site);
  await mkdir(path.join(archive.path(), 'sites'), { recursive: true });
  await writeFile(path.join(archive.path(), 'sites', 'Not A Slug.json'), '{}');

  expect((await sites.list(ctx)).map((s) => s.slug)).toEqual(['iceland']);
});

test('FilesystemSiteRepository leaves a plain site’s file without a presentation, and reads an older file as plain', async () => {
  const sites: SiteRepository = new FilesystemSiteRepository(archive.path());
  await sites.create(ctx, site);
  const file = path.join(archive.path(), 'sites', 'iceland.json');

  expect(JSON.parse(await readFile(file, 'utf8'))).not.toHaveProperty(
    'presentation',
  );
  expect((await sites.get(ctx, site.slug))?.site.presentation).toEqual(
    defaultPresentation,
  );
});
