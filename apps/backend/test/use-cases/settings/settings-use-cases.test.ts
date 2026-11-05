import { describe, expect, test } from 'vitest';
import { InMemorySettingsRepository } from '../../../src/adapters/outbound/memory/in-memory-settings-repository.ts';
import { SequentialIdGenerator } from '../../../src/adapters/outbound/memory/sequential-id-generator.ts';
import { GetSettings } from '../../../src/application/use-cases/settings/get-settings.ts';
import { InitialiseSettings } from '../../../src/application/use-cases/settings/initialise-settings.ts';
import { UpdateSettings } from '../../../src/application/use-cases/settings/update-settings.ts';
import { ctx } from '../../support/builders.ts';

function setUp() {
  const settings = new InMemorySettingsRepository();
  return {
    settings,
    initialise: new InitialiseSettings(settings, new SequentialIdGenerator()),
    get: new GetSettings(settings),
    update: new UpdateSettings(settings),
  };
}

const blankAuthor = {
  ok: false,
  error: {
    kind: 'validation-failed',
    issues: [{ path: ['author'], message: 'must not be blank' }],
  },
};

describe('InitialiseSettings', () => {
  test('sets FilmFile up with a new ID, its author and any copyright, trimmed', async () => {
    const { initialise, settings: repository } = setUp();

    const created = await initialise.execute(ctx, {
      author: ' Ben Pirt ',
      copyright: ' ',
    });

    const expected = {
      id: '00000000000000000000000001',
      author: 'Ben Pirt',
      copyright: null,
    };
    expect(created).toEqual({ ok: true, value: expected });
    expect((await repository.get())?.settings).toEqual(expected);
  });

  test('refuses a blank author (D44)', async () => {
    expect(await setUp().initialise.execute(ctx, { author: '  ' })).toEqual(
      blankAuthor,
    );
  });

  test('refuses to set up when it already is', async () => {
    const { initialise } = setUp();
    await initialise.execute(ctx, { author: 'First' });

    expect(await initialise.execute(ctx, { author: 'Second' })).toMatchObject({
      ok: false,
      error: { kind: 'already-exists', entity: 'settings' },
    });
  });
});

describe('GetSettings', () => {
  test('gives the settings with their version', async () => {
    const { initialise, get } = setUp();
    await initialise.execute(ctx, { author: 'Ben Pirt' });

    expect(await get.execute(ctx)).toMatchObject({
      ok: true,
      value: { settings: { author: 'Ben Pirt' }, version: '1' },
    });
  });

  test('says when FilmFile isn’t set up yet', async () => {
    expect(await setUp().get.execute(ctx)).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'settings', id: ctx.archiveId },
    });
  });
});

describe('UpdateSettings', () => {
  async function setUpWithSettings() {
    const setup = setUp();
    await setup.initialise.execute(ctx, { author: 'Ben', copyright: '© Ben' });
    return setup;
  }

  test('changes the details given, with blank or null clearing the copyright', async () => {
    const { update } = await setUpWithSettings();

    expect(
      await update.execute(ctx, {
        expectedVersion: '1',
        author: 'Ben Pirt',
        copyright: '',
      }),
    ).toEqual({
      ok: true,
      value: {
        settings: {
          id: '00000000000000000000000001',
          author: 'Ben Pirt',
          copyright: null,
        },
        version: '2',
      },
    });
  });

  test('leaves what isn’t given as it was', async () => {
    const { update } = await setUpWithSettings();

    expect(
      await update.execute(ctx, { expectedVersion: '1', copyright: null }),
    ).toMatchObject({
      ok: true,
      value: { settings: { author: 'Ben', copyright: null } },
    });
  });

  test('refuses a blank author, rather than clearing it', async () => {
    const { update } = await setUpWithSettings();

    expect(
      await update.execute(ctx, { expectedVersion: '1', author: ' ' }),
    ).toEqual(blankAuthor);
  });

  test('refuses when the settings changed since they were read', async () => {
    const { update } = await setUpWithSettings();
    await update.execute(ctx, { expectedVersion: '1', author: 'B. Pirt' });

    expect(
      await update.execute(ctx, { expectedVersion: '1', author: 'Ben' }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'concurrency-conflict', entity: 'settings' },
    });
  });

  test('says when FilmFile isn’t set up yet', async () => {
    expect(
      await setUp().update.execute(ctx, { expectedVersion: '1', author: 'X' }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'not-found', entity: 'settings' },
    });
  });
});
