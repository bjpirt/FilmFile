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
const twoHoursAgo = () =>
  new Date(Date.now() - 2 * 60 * 60 * 1000 - 60_000).toISOString();

function openApp(contents: ArchiveContents = {}, at = '/events'): FakeArchive {
  window.history.pushState(null, '', at);
  const archive = fakeArchive({
    settings: withAccount,
    sync: { bucket: 'backup-pirt' },
    ...contents,
  });
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

const header = () => screen.getByRole('banner');
const statusButton = () =>
  within(header()).findByRole('button', {
    name: /^(Sync|Not synced|First sync)/u,
  });

describe('the header’s sync status', () => {
  test.each([
    ['without the desktop app', { sync: { available: false } }],
    ['without a bucket', { sync: { bucket: null } }],
    ['without a Cloudflare account', { settings: setUpSettings }],
  ])('shows nothing %s', async (_, contents: ArchiveContents) => {
    openApp(contents);
    await screen.findByRole('link', { name: 'Settings' });
    // Let the sync status load before looking for it.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(
      within(header()).queryByRole('button', { name: /sync/iu }),
    ).toBeNull();
  });

  test('reads "Not synced yet" until the first sync', async () => {
    openApp();

    expect((await statusButton()).textContent).toBe('Not synced yet');
  });

  test('reads how long ago the last sync was, with the full time on hover', async () => {
    const at = twoHoursAgo();
    openApp({ sync: { bucket: 'backup-pirt', lastSyncedAt: at } });
    const button = await statusButton();

    expect(button.textContent).toBe('Synced 2 h ago');
    expect(button.getAttribute('aria-label')).toBe('Synced 2 h ago');
    expect(button.title).toBe(publishedTime(at));
  });

  test('opens a panel with the last sync, Sync and a link to the settings, and closes on Escape', async () => {
    const at = twoHoursAgo();
    openApp({ sync: { bucket: 'backup-pirt', lastSyncedAt: at } });
    const button = await statusButton();
    expect(button.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(button);

    const panel = screen.getByRole('dialog', { name: 'Sync' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(within(panel).getByText(`Synced ${publishedTime(at)}`)).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Sync' })).toBeTruthy();
    expect(
      within(panel).getByRole('link', { name: 'Sync settings' }),
    ).toHaveProperty('pathname', '/settings');

    fireEvent.keyDown(panel, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Sync' })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  test('closes when clicking elsewhere', async () => {
    openApp();
    fireEvent.click(await statusButton());
    expect(screen.getByRole('dialog', { name: 'Sync' })).toBeTruthy();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('dialog', { name: 'Sync' })).toBeNull();
  });

  test('syncs from the panel, reading "Syncing 34%" in the header, then "Synced just now" and what it sent', async () => {
    const archive = openApp({
      syncStates: [
        {
          state: 'running',
          bytesDone: 340,
          bytesTotal: 1000,
          filesDone: 1,
          filesTotal: 3,
        },
        { state: 'done', bytesDone: 1000, filesDone: 3 },
      ],
    });
    fireEvent.click(await statusButton());
    const panel = screen.getByRole('dialog', { name: 'Sync' });

    fireEvent.click(within(panel).getByRole('button', { name: 'Sync' }));

    expect(
      await within(header()).findByRole('button', { name: 'Syncing 34%' }),
    ).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(
      await within(panel).findByText(
        'Sent 3 files (1 KB).',
        {},
        {
          timeout: 3000,
        },
      ),
    ).toBeTruthy();
    expect(
      within(header()).getByRole('button', { name: 'Synced just now' }),
    ).toBeTruthy();
    expect(archive.syncs).toEqual(['backup-pirt']);
  });

  test('a failed sync reads "Sync didn\'t finish", and the panel says why and can try again', async () => {
    openApp({
      syncStates: [
        {
          state: 'failed',
          failure: 'unreachable',
          message: "Couldn't reach Cloudflare. Are you online?",
        },
      ],
    });
    fireEvent.click(await statusButton());
    const panel = screen.getByRole('dialog', { name: 'Sync' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Sync' }));

    const button = await within(header()).findByRole('button', {
      name: "Sync didn't finish",
    });
    expect(button.classList.contains('warning')).toBe(true);
    expect(
      within(panel).getByText("Couldn't reach Cloudflare. Are you online?", {
        exact: false,
      }),
    ).toBeTruthy();
    expect(
      within(panel)
        .getByRole('button', { name: 'Sync' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  test('Cancel reads "Stopping…" in the panel and the header, then the header goes back to the last finished sync', async () => {
    openApp({
      sync: { bucket: 'backup-pirt', lastSyncedAt: twoHoursAgo() },
      syncStates: [
        { state: 'running', bytesTotal: 100, filesTotal: 3 },
        { state: 'stopping', bytesTotal: 100, filesTotal: 3 },
        { state: 'stopping', bytesTotal: 100, filesTotal: 3 },
        { state: 'cancelled' },
      ],
    });
    fireEvent.click(await statusButton());
    const panel = screen.getByRole('dialog', { name: 'Sync' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Sync' }));
    fireEvent.click(
      await within(panel).findByRole('button', { name: 'Cancel' }),
    );

    expect(
      within(panel)
        .getByRole('button', { name: 'Stopping…' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      await within(header()).findByRole('button', { name: 'Stopping…' }),
    ).toBeTruthy();
    expect(
      await within(panel).findByText(
        'Sync stopped. The next sync carries on where this one left off.',
        {},
        { timeout: 3000 },
      ),
    ).toBeTruthy();
    expect(
      within(header()).getByRole('button', { name: 'Synced 2 h ago' }),
    ).toBeTruthy();
  });

  test('a sync started in Settings shows in the header', async () => {
    openApp(
      {
        syncStates: [
          { state: 'running', bytesDone: 50, bytesTotal: 100 },
          { state: 'done' },
        ],
      },
      '/settings',
    );
    const section = await screen.findByRole('region', { name: 'Sync' });
    await statusButton();

    fireEvent.click(within(section).getByRole('button', { name: 'Sync' }));

    expect(
      await within(header()).findByRole('button', { name: 'Syncing 50%' }),
    ).toBeTruthy();
    expect(
      await within(header()).findByRole(
        'button',
        { name: 'Synced just now' },
        { timeout: 3000 },
      ),
    ).toBeTruthy();
  });

  test('appears once a bucket is saved in Settings', async () => {
    openApp({ sync: { bucket: null } }, '/settings');
    const section = await screen.findByRole('region', { name: 'Sync' });
    const form = within(section).getByRole('form', { name: 'Where to sync' });
    fireEvent.change(within(form).getByLabelText('Bucket'), {
      target: { value: 'backup-pirt' },
    });

    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect((await statusButton()).textContent).toBe('Not synced yet');
  });

  test('reads "Checking…" while a sync checks the library and the bucket', async () => {
    openApp({
      syncStates: [
        {
          state: 'running',
          phase: 'checking-library',
          filesChecked: 1200,
          filesToCheck: 2340,
        },
        { state: 'running', phase: 'checking-bucket' },
        { state: 'done' },
      ],
    });
    fireEvent.click(await statusButton());
    const panel = screen.getByRole('dialog', { name: 'Sync' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Sync' }));

    expect(
      await within(header()).findByRole('button', { name: 'Checking…' }),
    ).toBeTruthy();
    expect(
      within(panel).getByText('Checking the library… 1,200 of 2,340 files'),
    ).toBeTruthy();
    expect(await within(panel).findByText('Checking the bucket…')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  test('a first sync reads its share of the whole library, with the time left', async () => {
    openApp({
      syncStates: [
        {
          state: 'running',
          phase: 'uploading',
          first: true,
          bytesDone: 1_000_000_000,
          bytesTotal: 22_000_000_000,
          library: {
            bytes: 34_000_000_000,
            files: 2340,
            bytesBackedUp: 13_000_000_000,
            filesBackedUp: 1212,
          },
          secondsLeft: 2 * 3600,
        },
        { state: 'done' },
      ],
    });
    fireEvent.click(await statusButton());
    const panel = screen.getByRole('dialog', { name: 'Sync' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Sync' }));

    expect(
      await within(header()).findByRole('button', { name: 'Syncing 38%' }),
    ).toBeTruthy();
    expect(
      within(panel).getByText(
        'Backed up 13 GB of 34 GB (1,212 of 2,340 files)',
      ),
    ).toBeTruthy();
    expect(within(panel).getByText('About 2 h left')).toBeTruthy();
  });

  test('between runs, reads how far a first sync that didn’t finish got', async () => {
    openApp({
      firstSync: {
        bytes: 34_000_000_000,
        files: 2340,
        bytesBackedUp: 13_000_000_000,
        filesBackedUp: 1212,
      },
    });
    const button = await statusButton();

    expect(button.textContent).toBe('First sync 38% done');
    fireEvent.click(button);
    expect(
      within(screen.getByRole('dialog', { name: 'Sync' })).getByText(
        "The first sync didn't finish: 13 GB of 34 GB backed up. Sync carries on from there.",
      ),
    ).toBeTruthy();
  });
});
