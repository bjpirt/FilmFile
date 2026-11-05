import { describe, expect, test } from 'vitest';
import type { SettingsRepository } from '../../src/application/ports/settings-repository.ts';
import { err, ok } from '../../src/domain/shared/result.ts';
import { aSettings, ctx } from '../support/builders.ts';

/** What every SettingsRepository must do, run against each adapter. */
export function settingsRepositoryContract(
  name: string,
  makeRepository: () => SettingsRepository,
): void {
  describe(`${name} meets the SettingsRepository contract`, () => {
    test('has no settings until they are created', async () => {
      expect(await makeRepository().get(ctx)).toBeUndefined();
    });

    test('gets back exactly the settings created, with a version', async () => {
      const settings = makeRepository();
      const created = aSettings('Ben Pirt', { copyright: '© Ben Pirt' });

      expect(await settings.create(ctx, created)).toEqual(ok(undefined));
      const read = await settings.get(ctx);
      expect(read?.settings).toEqual(created);
      expect(read?.version).toMatch(/.+/);
    });

    test('keeps settings with no copyright as having none', async () => {
      const settings = makeRepository();
      await settings.create(ctx, aSettings());

      expect((await settings.get(ctx))?.settings).toEqual(aSettings());
    });

    test('refuses to create settings a second time, keeping the first', async () => {
      const settings = makeRepository();
      await settings.create(ctx, aSettings('First'));

      expect(await settings.create(ctx, aSettings('Second'))).toEqual(
        err({ kind: 'already-exists', entity: 'settings', id: aSettings().id }),
      );
      expect((await settings.get(ctx))?.settings.author).toBe('First');
    });

    test('saves the settings read with the current version, and gives the new version', async () => {
      const settings = makeRepository();
      await settings.create(ctx, aSettings());
      const read = await settings.get(ctx);
      const changed = aSettings('B. Pirt', { copyright: '© B. Pirt' });

      const saved = await settings.save(ctx, changed, read?.version ?? '');

      expect(saved.ok && saved.value).not.toBe(read?.version);
      expect(await settings.get(ctx)).toEqual({
        settings: changed,
        version: saved.ok && saved.value,
      });
    });

    test('refuses a save when the settings changed since they were read', async () => {
      const settings = makeRepository();
      await settings.create(ctx, aSettings());
      const read = await settings.get(ctx);
      await settings.save(ctx, aSettings('Film'), read?.version ?? '');

      expect(
        await settings.save(ctx, aSettings('Photos'), read?.version ?? ''),
      ).toEqual(
        err({
          kind: 'concurrency-conflict',
          entity: 'settings',
          id: aSettings().id,
        }),
      );
      expect((await settings.get(ctx))?.settings.author).toBe('Film');
    });

    test('refuses to save settings that were never created', async () => {
      expect(await makeRepository().save(ctx, aSettings(), 'any')).toEqual(
        err({ kind: 'not-found', entity: 'settings', id: aSettings().id }),
      );
    });
  });
}
