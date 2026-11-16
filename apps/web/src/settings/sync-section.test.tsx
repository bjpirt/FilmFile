// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { App } from '../app.tsx';
import { publishedTime } from '../sites/published-time.ts';
import {
  fakeArchive,
  setUpSettings,
  type ArchiveContents,
  type FakeArchive,
} from '../testing/fake-archive.ts';

afterEach(cleanup);

const withAccount = {
  ...setUpSettings,
  cloudflareAccountId: '0123456789abcdef0123456789abcdef',
};
const syncedAt = '2026-11-16T14:02:00.000Z';

function openSettings(contents: ArchiveContents = {}): FakeArchive {
  window.history.pushState(null, '', '/settings');
  const archive = fakeArchive({ settings: withAccount, ...contents });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <App api={archive.api} />
    </QueryClientProvider>,
  );
  return archive;
}

const section = () => screen.findByRole('region', { name: 'Sync' });

function fill(bucket: string, name: string) {
  const form = screen.getByRole('form', { name: 'Where to sync' });
  fireEvent.change(within(form).getByLabelText('Bucket'), {
    target: { value: bucket },
  });
  fireEvent.change(within(form).getByLabelText("This computer's name"), {
    target: { value: name },
  });
  return within(form).getByRole('button', { name: 'Save' });
}

describe('Settings › Sync', () => {
  test('without the desktop app, says sync works there, with no fields', async () => {
    openSettings({ sync: { available: false, computerName: null } });
    const sync = await section();

    expect(
      within(sync).getByText('Sync works in the FilmFile app.'),
    ).toBeTruthy();
    expect(within(sync).queryByLabelText('Bucket')).toBeNull();
  });

  test('starts with this computer’s name and no bucket, and asks for one', async () => {
    openSettings();
    const sync = await section();

    expect(within(sync).getByLabelText("This computer's name")).toHaveProperty(
      'value',
      'Test computer',
    );
    expect(
      within(sync).getByText('Say which bucket to sync with.'),
    ).toBeTruthy();
    expect(
      within(sync)
        .getByRole('button', { name: 'Sync' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  test('asks for a bucket while there is no Cloudflare account, even with one saved', async () => {
    openSettings({
      settings: setUpSettings,
      sync: { bucket: 'backup-pirt' },
    });
    const sync = await section();

    expect(
      within(sync).getByText('Say which bucket to sync with.'),
    ).toBeTruthy();
  });

  test('saves the bucket and name with Save, then can sync', async () => {
    const archive = openSettings();
    await section();

    fireEvent.click(fill(' backup-pirt ', 'Studio'));

    expect(await screen.findByText('Not synced yet')).toBeTruthy();
    expect(archive.syncSettings()).toMatchObject({
      bucket: 'backup-pirt',
      computerName: 'Studio',
    });
    expect(
      screen.getByRole('button', { name: 'Sync' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  test('says why a field is refused, in the service’s words, saving nothing', async () => {
    const archive = openSettings();
    await section();

    fireEvent.click(fill('Backup_Pirt', 'Studio'));

    expect(
      await screen.findByText(/^The bucket must be 3 to 63 lower-case/u),
    ).toBeTruthy();
    expect(archive.syncSettings().bucket).toBeNull();
  });

  test('shows the upload by size and files, then when it synced and what it sent', async () => {
    const archive = openSettings({
      sync: { bucket: 'backup-pirt' },
      syncStates: [
        {
          state: 'running',
          bytesDone: 1_200_000_000,
          bytesTotal: 34_000_000_000,
          filesDone: 12,
          filesTotal: 340,
        },
        {
          state: 'done',
          bytesDone: 34_000_000_000,
          filesDone: 340,
        },
      ],
    });
    await screen.findByText('Not synced yet');

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    expect(
      await screen.findByText('Uploading 1.2 GB of 34 GB (12 of 340 files)'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(
      await screen.findByText(
        `Synced ${publishedTime(syncedAt)}`,
        {},
        {
          timeout: 3000,
        },
      ),
    ).toBeTruthy();
    expect(screen.getByText('Sent 340 files (34 GB).')).toBeTruthy();
    expect(archive.syncs).toEqual(['backup-pirt']);
  });

  test('Cancel stops it, and it says nothing already backed up was lost', async () => {
    const archive = openSettings({
      sync: { bucket: 'backup-pirt' },
      syncStates: [
        { state: 'running', bytesTotal: 100, filesTotal: 3 },
        { state: 'cancelled' },
      ],
    });
    await screen.findByText('Not synced yet');
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(
      await screen.findByText(
        "Sync didn't finish. Nothing already backed up was lost. Try again.",
        {},
        { timeout: 3000 },
      ),
    ).toBeTruthy();
    expect(archive.syncsCancelled).toEqual(['backup-pirt']);
  });

  test.each([
    [
      'keys-refused',
      'Cloudflare refused the keys in the [filmfile] profile.',
      true,
      true,
    ],
    ['unreachable', "Couldn't reach Cloudflare. Are you online?", false, true],
    [
      'not-empty',
      "That bucket has something else in it, so FilmFile won't sync with it.",
      false,
      false,
    ],
    [
      'another-library',
      'That bucket belongs to another FilmFile library.',
      false,
      false,
    ],
  ] as const)(
    'a sync that fails with %s says so',
    async (failure, message, linksToSettings, unfinished) => {
      openSettings({
        sync: { bucket: 'backup-pirt' },
        syncStates: [{ state: 'failed', failure, message }],
      });
      await screen.findByText('Not synced yet');

      fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
      const alert = await screen.findByText(message, { exact: false });

      expect(
        within(alert).queryByRole('link', { name: 'Open Settings' }) !== null,
      ).toBe(linksToSettings);
      expect(alert.textContent.includes("Sync didn't finish.")).toBe(
        unfinished,
      );
    },
  );
});
