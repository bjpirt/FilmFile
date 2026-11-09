import { describe, expect, test } from 'vitest';
import { InMemorySettingsRepository } from '../../../src/adapters/outbound/memory/in-memory-settings-repository.ts';
import { InMemoryRollRepository } from '../../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { SequentialIdGenerator } from '../../../src/adapters/outbound/memory/sequential-id-generator.ts';
import { GetSettings } from '../../../src/application/use-cases/settings/get-settings.ts';
import { InitialiseSettings } from '../../../src/application/use-cases/settings/initialise-settings.ts';
import { UpdateSettings } from '../../../src/application/use-cases/settings/update-settings.ts';
import { aRoll, ctx, ulidFor } from '../../support/builders.ts';

function setUp() {
  const settings = new InMemorySettingsRepository();
  const rolls = new InMemoryRollRepository();
  return {
    settings,
    rolls,
    initialise: new InitialiseSettings(settings, new SequentialIdGenerator()),
    get: new GetSettings(settings),
    update: new UpdateSettings(settings, rolls),
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
      rollNumberPattern: '{year}-{n:3}',
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
          rollNumberPattern: '{year}-{n:3}',
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

describe('UpdateSettings roll number pattern (D88)', () => {
  async function setUpWithSettings() {
    const setup = setUp();
    await setup.initialise.execute(ctx, { author: 'Ben' });
    return setup;
  }

  function patternIssue(message: string) {
    return {
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [{ path: ['rollNumberPattern'], message }],
      },
    };
  }

  test('saves a valid pattern', async () => {
    const { update } = await setUpWithSettings();

    expect(
      await update.execute(ctx, {
        expectedVersion: '1',
        rollNumberPattern: 'BP-{year}-{n:2}',
      }),
    ).toMatchObject({
      ok: true,
      value: { settings: { rollNumberPattern: 'BP-{year}-{n:2}' } },
    });
  });

  test('refuses an invalid pattern and changes nothing', async () => {
    const { update, settings } = await setUpWithSettings();

    expect(
      await update.execute(ctx, {
        expectedVersion: '1',
        rollNumberPattern: '{year}',
      }),
    ).toEqual(patternIssue('needs a sequence number like {n:3}'));
    expect((await settings.get())?.version).toBe('1');
  });

  test('refuses a month, day or event that rolls lack, until they all have it', async () => {
    const { update, rolls } = await setUpWithSettings();
    await rolls.create(ctx, aRoll({ roll: 'A', shot: '2026-09' }));
    await rolls.create(ctx, aRoll({ id: ulidFor(2), roll: 'B', shot: '2026' }));

    expect(
      await update.execute(ctx, {
        expectedVersion: '1',
        rollNumberPattern: '{year}{month}-{n:3}',
      }),
    ).toEqual(
      patternIssue('needs a shot month on every roll, and 1 roll has none'),
    );
    expect(
      await update.execute(ctx, {
        expectedVersion: '1',
        rollNumberPattern: '{day}-{n:3}',
      }),
    ).toEqual(
      patternIssue('needs a shot day on every roll, and 2 rolls have none'),
    );
    expect(
      await update.execute(ctx, {
        expectedVersion: '1',
        rollNumberPattern: '{event}-{n:3}',
      }),
    ).toEqual(
      patternIssue('needs an event on every roll, and 2 rolls have none'),
    );
  });

  test('accepts a month once every roll has one', async () => {
    const { update, rolls } = await setUpWithSettings();
    await rolls.create(ctx, aRoll({ roll: 'A', shot: '2026-09' }));

    expect(
      await update.execute(ctx, {
        expectedVersion: '1',
        rollNumberPattern: '{year}{month}-{n:3}',
      }),
    ).toMatchObject({ ok: true });
  });
});
