import { describe, expect, test } from 'vitest';
import type { ArchiveRepository } from '../../src/application/ports/archive-repository.ts';
import { err, ok } from '../../src/domain/shared/result.ts';
import { anArchive, ctx } from '../support/builders.ts';

/** What every ArchiveRepository must do, run against each adapter. */
export function archiveRepositoryContract(
  name: string,
  makeRepository: () => ArchiveRepository,
): void {
  describe(`${name} meets the ArchiveRepository contract`, () => {
    test('has no archive until one is created', async () => {
      expect(await makeRepository().get(ctx)).toBeUndefined();
    });

    test('gets back exactly the archive created, with a version', async () => {
      const archives = makeRepository();
      const archive = anArchive('Ben’s film archive', {
        author: 'Ben Pirt',
        copyright: '© Ben Pirt',
      });

      expect(await archives.create(ctx, archive)).toEqual(ok(undefined));
      const read = await archives.get(ctx);
      expect(read?.archive).toEqual(archive);
      expect(read?.version).toMatch(/.+/);
    });

    test('keeps an archive with no author or copyright as having none', async () => {
      const archives = makeRepository();
      await archives.create(ctx, anArchive());

      expect((await archives.get(ctx))?.archive).toEqual(anArchive());
    });

    test('refuses to create a second archive, keeping the first', async () => {
      const archives = makeRepository();
      await archives.create(ctx, anArchive('First'));

      expect(await archives.create(ctx, anArchive('Second'))).toEqual(
        err({ kind: 'already-exists', entity: 'archive', id: anArchive().id }),
      );
      expect((await archives.get(ctx))?.archive.name).toBe('First');
    });

    test('saves the archive read with the current version, and gives the new version', async () => {
      const archives = makeRepository();
      await archives.create(ctx, anArchive());
      const read = await archives.get(ctx);
      const changed = anArchive('Film', { author: 'Ben Pirt' });

      const saved = await archives.save(ctx, changed, read?.version ?? '');

      expect(saved.ok && saved.value).not.toBe(read?.version);
      expect(await archives.get(ctx)).toEqual({
        archive: changed,
        version: saved.ok && saved.value,
      });
    });

    test('refuses a save when the archive changed since it was read', async () => {
      const archives = makeRepository();
      await archives.create(ctx, anArchive());
      const read = await archives.get(ctx);
      await archives.save(ctx, anArchive('Film'), read?.version ?? '');

      expect(
        await archives.save(ctx, anArchive('Photos'), read?.version ?? ''),
      ).toEqual(
        err({
          kind: 'concurrency-conflict',
          entity: 'archive',
          id: anArchive().id,
        }),
      );
      expect((await archives.get(ctx))?.archive.name).toBe('Film');
    });

    test('refuses to save an archive that was never created', async () => {
      expect(await makeRepository().save(ctx, anArchive(), 'any')).toEqual(
        err({ kind: 'not-found', entity: 'archive', id: anArchive().id }),
      );
    });
  });
}
