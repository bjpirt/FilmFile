import { describe, expect, test } from 'vitest';
import type { SiteRepository } from '../../src/application/ports/site-repository.ts';
import { isFrameId, isRollId, isSiteId } from '../../src/domain/shared/ids.ts';
import { isSlug } from '../../src/domain/shared/slug.ts';
import { defaultPresentation, type Site } from '../../src/domain/sites/site.ts';
import { ctx } from '../support/builders.ts';
import { checked } from '../support/checked.ts';

const slug = (value: string) => checked(value, isSlug);

function aSite(name: string, over: Partial<Site> = {}): Site {
  return {
    id: checked('01JD8M2KZXQ4T6V8W0Y1A3C5E7', isSiteId),
    slug: slug(name.toLowerCase().replaceAll(' ', '-')),
    name,
    selection: { rules: [], excluded: [] },
    presentation: defaultPresentation,
    ...over,
  };
}

const fullSelection: Site['selection'] = {
  rules: [
    { kind: 'rating', atLeast: 4 },
    { kind: 'event', events: [slug('iceland')] },
    { kind: 'roll', rolls: [checked('01JD8M2KZXQ4T6V8W0Y1A3C5E8', isRollId)] },
    { kind: 'camera', cameras: [slug('leica-m6')] },
    { kind: 'lens', lenses: [slug('summicron')] },
    { kind: 'film', films: [slug('portra-400')] },
    { kind: 'shot-after', date: '2026-09' },
    { kind: 'shot-before', date: '2026-09-30' },
    { kind: 'has', version: 'final' },
  ],
  excluded: [
    {
      rollId: checked('01JD8M2KZXQ4T6V8W0Y1A3C5E8', isRollId),
      frameId: checked('01JD8M2KZXQ4T6V8W0Y1A3C5E9', isFrameId),
    },
    {
      rollId: checked('01JD8M2KZXQ4T6V8W0Y1A3C5E8', isRollId),
      frameId: checked('01JD8M2KZXQ4T6V8W0Y1A3C5EA', isFrameId),
    },
  ],
};

/** What every SiteRepository must do, run against each adapter. */
export function siteRepositoryContract(
  name: string,
  make: () => SiteRepository,
): void {
  describe(`${name} meets the SiteRepository contract`, () => {
    test('has no sites to begin with', async () => {
      expect(await make().list(ctx)).toEqual([]);
      expect(await make().get(ctx, slug('nothing'))).toBeUndefined();
    });

    test('keeps a site with all its rules and frames by hand, and reads it back', async () => {
      const sites = make();
      const site = aSite('Iceland highlights', { selection: fullSelection });

      expect((await sites.create(ctx, site)).ok).toBe(true);

      expect((await sites.get(ctx, site.slug))?.site).toEqual(site);
    });

    test('keeps how a site is presented, and a plain site stays plain', async () => {
      const sites = make();
      const shown = aSite('Iceland', {
        presentation: {
          title: 'Iceland in September',
          copyright: '© Ben Pirt',
          captions: ['title', 'shot', 'camera'],
        },
      });
      await sites.create(ctx, shown);
      await sites.create(ctx, aSite('Norway'));

      expect((await sites.get(ctx, shown.slug))?.site).toEqual(shown);
      expect((await sites.get(ctx, slug('norway')))?.site.presentation).toEqual(
        defaultPresentation,
      );
    });

    test('lists the sites by name', async () => {
      const sites = make();
      await sites.create(ctx, aSite('Westfjords'));
      await sites.create(ctx, aSite('Iceland'));

      expect((await sites.list(ctx)).map((site) => site.name)).toEqual([
        'Iceland',
        'Westfjords',
      ]);
    });

    test('refuses a second site with the same slug', async () => {
      const sites = make();
      await sites.create(ctx, aSite('Iceland'));

      expect(await sites.create(ctx, aSite('Iceland'))).toEqual({
        ok: false,
        error: { kind: 'already-exists', entity: 'site', id: 'iceland' },
      });
    });

    test('saves a change against the version it was read at, and gives the new version', async () => {
      const sites = make();
      const site = aSite('Iceland');
      await sites.create(ctx, site);
      const read = await sites.get(ctx, site.slug);

      const saved = await sites.save(
        ctx,
        { ...site, selection: fullSelection },
        read?.version ?? '',
      );

      expect(saved.ok).toBe(true);
      const after = await sites.get(ctx, site.slug);
      expect(after?.site.selection).toEqual(fullSelection);
      expect(saved.ok && saved.value).toBe(after?.version);
      expect(after?.version).not.toBe(read?.version);
    });

    test('refuses a save when the site changed since it was read, keeping what is there', async () => {
      const sites = make();
      const site = aSite('Iceland');
      await sites.create(ctx, site);
      const first = await sites.get(ctx, site.slug);
      await sites.save(
        ctx,
        { ...site, name: 'Iceland!' },
        first?.version ?? '',
      );

      const stale = await sites.save(
        ctx,
        { ...site, name: 'Mine' },
        first?.version ?? '',
      );

      expect(stale).toEqual({
        ok: false,
        error: { kind: 'concurrency-conflict', entity: 'site', id: 'iceland' },
      });
      expect((await sites.get(ctx, site.slug))?.site.name).toBe('Iceland!');
    });

    test('saving what is already there gives the same version', async () => {
      const sites = make();
      const site = aSite('Iceland', { selection: fullSelection });
      await sites.create(ctx, site);
      const read = await sites.get(ctx, site.slug);

      const saved = await sites.save(ctx, site, read?.version ?? '');

      expect(saved.ok && saved.value).toBe(read?.version);
    });

    test('refuses to save a site that is not there', async () => {
      expect(await make().save(ctx, aSite('Iceland'), 'x')).toEqual({
        ok: false,
        error: { kind: 'not-found', entity: 'site', id: 'iceland' },
      });
    });

    test('renames a site: it is found at its new slug and no longer at its old one', async () => {
      const sites = make();
      const site = aSite('Iceland');
      await sites.create(ctx, site);
      const read = await sites.get(ctx, site.slug);
      const renamed = aSite('Iceland 2026', { id: site.id });

      const result = await sites.rename(
        ctx,
        site.slug,
        renamed,
        read?.version ?? '',
      );

      expect(result.ok).toBe(true);
      expect((await sites.get(ctx, renamed.slug))?.site).toEqual(renamed);
      expect(await sites.get(ctx, site.slug)).toBeUndefined();
      expect((await sites.list(ctx)).map((s) => s.slug)).toEqual([
        'iceland-2026',
      ]);
    });

    test('refuses a rename to a slug that is taken, leaving both sites as they were', async () => {
      const sites = make();
      await sites.create(ctx, aSite('Iceland'));
      await sites.create(ctx, aSite('Norway'));
      const read = await sites.get(ctx, slug('iceland'));

      const result = await sites.rename(
        ctx,
        slug('iceland'),
        aSite('Norway'),
        read?.version ?? '',
      );

      expect(result).toEqual({
        ok: false,
        error: { kind: 'already-exists', entity: 'site', id: 'norway' },
      });
      expect((await sites.list(ctx)).map((s) => s.name)).toEqual([
        'Iceland',
        'Norway',
      ]);
    });

    test('refuses a rename of a site that changed since it was read', async () => {
      const sites = make();
      await sites.create(ctx, aSite('Iceland'));

      const result = await sites.rename(
        ctx,
        slug('iceland'),
        aSite('Elsewhere'),
        'stale',
      );

      expect(result).toEqual({
        ok: false,
        error: { kind: 'concurrency-conflict', entity: 'site', id: 'iceland' },
      });
      expect((await sites.list(ctx)).map((s) => s.name)).toEqual(['Iceland']);
    });

    test('removes a site', async () => {
      const sites = make();
      await sites.create(ctx, aSite('Iceland'));

      const removed = await sites.remove(
        ctx,
        slug('iceland'),
        new Date('2026-11-02T12:00:00.000Z'),
      );

      expect(removed.ok).toBe(true);
      expect(await sites.list(ctx)).toEqual([]);
    });

    test('says there is no site to remove when there is none', async () => {
      expect(await make().remove(ctx, slug('iceland'), new Date())).toEqual({
        ok: false,
        error: { kind: 'not-found', entity: 'site', id: 'iceland' },
      });
    });
  });
}
