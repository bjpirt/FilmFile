import { describe, expect, test } from 'vitest';
import { InMemoryArchiveRepository } from '../../../src/adapters/outbound/memory/in-memory-archive-repository.ts';
import { SequentialIdGenerator } from '../../../src/adapters/outbound/memory/sequential-id-generator.ts';
import { GetArchive } from '../../../src/application/use-cases/archive/get-archive.ts';
import { InitialiseArchive } from '../../../src/application/use-cases/archive/initialise-archive.ts';
import { UpdateArchive } from '../../../src/application/use-cases/archive/update-archive.ts';
import { ctx } from '../../support/builders.ts';

function setUp() {
  const archives = new InMemoryArchiveRepository();
  return {
    archives,
    initialise: new InitialiseArchive(archives, new SequentialIdGenerator()),
    get: new GetArchive(archives),
    update: new UpdateArchive(archives),
  };
}

describe('InitialiseArchive', () => {
  test('sets the archive up with a new ID, its name, and any author and copyright, trimmed', async () => {
    const { initialise, archives } = setUp();

    const created = await initialise.execute(ctx, {
      name: ' Ben’s film archive ',
      author: 'Ben Pirt',
      copyright: ' ',
    });

    const archive = {
      id: '00000000000000000000000001',
      name: 'Ben’s film archive',
      author: 'Ben Pirt',
      copyright: null,
    };
    expect(created).toEqual({ ok: true, value: archive });
    expect((await archives.get())?.archive).toEqual(archive);
  });

  test('refuses a blank name', async () => {
    expect(await setUp().initialise.execute(ctx, { name: '  ' })).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [{ path: ['name'], message: 'must not be blank' }],
      },
    });
  });

  test('refuses to set up an archive that already is', async () => {
    const { initialise } = setUp();
    await initialise.execute(ctx, { name: 'First' });

    expect(await initialise.execute(ctx, { name: 'Second' })).toMatchObject({
      ok: false,
      error: { kind: 'already-exists', entity: 'archive' },
    });
  });
});

describe('GetArchive', () => {
  test('gives the archive with its version', async () => {
    const { initialise, get } = setUp();
    await initialise.execute(ctx, { name: 'Film' });

    expect(await get.execute(ctx)).toMatchObject({
      ok: true,
      value: { archive: { name: 'Film' }, version: '1' },
    });
  });

  test('says when the archive isn’t set up yet', async () => {
    expect(await setUp().get.execute(ctx)).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'archive', id: ctx.archiveId },
    });
  });
});

describe('UpdateArchive', () => {
  async function setUpWithArchive() {
    const setup = setUp();
    await setup.initialise.execute(ctx, {
      name: 'Film',
      author: 'Ben',
      copyright: '© Ben',
    });
    return setup;
  }

  test('changes the details given, leaving the rest, with blank or null clearing them', async () => {
    const { update } = await setUpWithArchive();

    expect(
      await update.execute(ctx, {
        expectedVersion: '1',
        name: 'Ben’s film archive',
        author: '',
        copyright: null,
      }),
    ).toEqual({
      ok: true,
      value: {
        archive: {
          id: '00000000000000000000000001',
          name: 'Ben’s film archive',
          author: null,
          copyright: null,
        },
        version: '2',
      },
    });
  });

  test('leaves what isn’t given as it was', async () => {
    const { update } = await setUpWithArchive();

    expect(
      await update.execute(ctx, { expectedVersion: '1', author: 'Ben Pirt' }),
    ).toMatchObject({
      ok: true,
      value: {
        archive: { name: 'Film', author: 'Ben Pirt', copyright: '© Ben' },
      },
    });
  });

  test('refuses a blank name', async () => {
    const { update } = await setUpWithArchive();

    expect(
      await update.execute(ctx, { expectedVersion: '1', name: ' ' }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['name'] }] },
    });
  });

  test('refuses when the archive changed since it was read', async () => {
    const { update } = await setUpWithArchive();
    await update.execute(ctx, { expectedVersion: '1', name: 'Photos' });

    expect(
      await update.execute(ctx, { expectedVersion: '1', name: 'Film' }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'concurrency-conflict', entity: 'archive' },
    });
  });

  test('says when the archive isn’t set up yet', async () => {
    expect(
      await setUp().update.execute(ctx, { expectedVersion: '1', name: 'X' }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'not-found', entity: 'archive' },
    });
  });
});
