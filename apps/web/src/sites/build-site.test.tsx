// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import {
  aFrame,
  aRoll,
  fakeArchive,
  type FakeArchive,
} from '../testing/fake-archive.ts';
import { SitePage } from './site-page.tsx';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const aSite = {
  id: '01JC8Z7K3M00000000000000S1',
  slug: 'iceland',
  name: 'Iceland',
  selection: { rules: [], excluded: [] },
};

function archiveWith(extra: Parameters<typeof fakeArchive>[0] = {}) {
  return fakeArchive({
    rolls: [
      aRoll('2026-001', {
        frames: [aFrame('1', '12340001.jpg'), aFrame('2', '12340002.jpg')],
      }),
    ],
    sites: [aSite],
    ...extra,
  });
}

function renderPage(archive: FakeArchive) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SitePage api={archive.api} slug="iceland" />
    </QueryClientProvider>,
  );
}

test('says a site never built is "Not built yet", with no way to open it', async () => {
  renderPage(archiveWith());

  expect(await screen.findByText('Not built yet')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Build site' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Open site' })).toBeNull();
});

test('builds the site, following it to "Site built in Sites/iceland: …", then offers to open it', async () => {
  const archive = archiveWith({
    siteBuildStates: [
      { state: 'running', done: 1, total: 4 },
      { state: 'running', done: 3, total: 4 },
      { state: 'done', done: 4, total: 4 },
    ],
  });
  renderPage(archive);
  fireEvent.click(await screen.findByRole('button', { name: 'Build site' }));

  expect(await screen.findByText('Making images: 1 of 4')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  expect(
    await screen.findByText(
      'Site built in Sites/iceland: 2 photos (3 images made, 1 unchanged).',
    ),
  ).toBeTruthy();
  expect(await screen.findByText('Up to date')).toBeTruthy();
  expect(archive.siteBuilds).toEqual(['iceland']);
  const open = screen.getByRole('link', { name: 'Open site' });
  expect(open.getAttribute('href')).toBe('/built-sites/iceland/');
  expect(open.getAttribute('target')).toBe('_blank');
});

test('cancels a build while it runs', async () => {
  const archive = archiveWith({
    siteBuildStates: [{ state: 'running', done: 1, total: 4 }],
  });
  renderPage(archive);
  fireEvent.click(await screen.findByRole('button', { name: 'Build site' }));
  await screen.findByText('Making images: 1 of 4');

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  await waitFor(() => {
    expect(archive.siteBuildsCancelled).toEqual(['iceland']);
  });
});

test('says a build was cancelled, and one that failed', async () => {
  renderPage(
    archiveWith({
      siteBuildStates: [{ state: 'cancelled', done: 1, total: 4 }],
    }),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Build site' }));
  expect(await screen.findByText('Build cancelled.')).toBeTruthy();
  cleanup();

  renderPage(
    archiveWith({ siteBuildStates: [{ state: 'failed', done: 1, total: 4 }] }),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Build site' }));
  expect(
    (await screen.findByText("Couldn't build the site.")).getAttribute('role'),
  ).toBe('alert');
});

test('says why a site is out of date, and offers to open what was built', async () => {
  renderPage(
    archiveWith({
      siteStatuses: {
        iceland: {
          freshness: 'out-of-date',
          message: 'Out of date: 3 frames added, 1 removed, 2 changed',
        },
      },
    }),
  );

  expect(
    await screen.findByText(
      'Out of date: 3 frames added, 1 removed, 2 changed',
    ),
  ).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open site' })).toBeTruthy();
});

test('an edit makes an up-to-date site out of date', async () => {
  const archive = archiveWith({
    siteStatuses: {
      iceland: { freshness: 'up-to-date', message: 'Up to date' },
    },
  });
  renderPage(archive);
  await screen.findByText('Up to date');

  fireEvent.change(screen.getByLabelText('Organise by'), {
    target: { value: 'rolls' },
  });

  expect(await screen.findByText('Out of date: options changed')).toBeTruthy();
});

test('refuses to build over a folder holding something else, saying why', async () => {
  const archive = archiveWith({
    siteStatuses: {
      iceland: {
        freshness: 'in-the-way',
        message: 'Sites/iceland holds something else',
      },
    },
  });
  renderPage(archive);

  expect((await screen.findByRole('alert')).textContent).toBe(
    "Sites/iceland holds something else, so the site can't be built there.",
  );
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Build site' })
      .disabled,
  ).toBe(true);
  expect(archive.siteBuilds).toEqual([]);
});

test('asks "This site has no frames. Build it anyway?" before building an empty site', async () => {
  const archive = archiveWith({ rolls: [aRoll('2026-001')] });
  renderPage(archive);
  await screen.findByText('No frames match');

  fireEvent.click(screen.getByRole('button', { name: 'Build site' }));
  expect(
    screen.getByText('This site has no frames. Build it anyway?'),
  ).toBeTruthy();
  expect(archive.siteBuilds).toEqual([]);

  fireEvent.click(screen.getByRole('button', { name: 'Build site' }));
  await waitFor(() => {
    expect(archive.siteBuilds).toEqual(['iceland']);
  });
});

test('Cancel on the empty-site question builds nothing', async () => {
  const archive = archiveWith({ rolls: [aRoll('2026-001')] });
  renderPage(archive);
  await screen.findByText('No frames match');
  fireEvent.click(screen.getByRole('button', { name: 'Build site' }));

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.queryByText(/Build it anyway/)).toBeNull();
  expect(archive.siteBuilds).toEqual([]);
});

test('shows how the site is presented: "Organise by" at Both, and no page title, intro or Group by', async () => {
  renderPage(archiveWith());

  const organiseBy =
    await screen.findByLabelText<HTMLSelectElement>('Organise by');
  expect(organiseBy.value).toBe('both');
  expect([...organiseBy.options].map((option) => option.text)).toEqual([
    'Events',
    'Rolls',
    'Both',
  ]);
  expect(screen.queryByLabelText('Group by')).toBeNull();
  expect(screen.queryByLabelText('Page title')).toBeNull();
  expect(screen.queryByLabelText('Intro')).toBeNull();
  expect(screen.getByLabelText<HTMLInputElement>('Title').checked).toBe(true);
  expect(screen.getByLabelText<HTMLInputElement>('Camera').checked).toBe(false);
});

test('saves a choice at once', async () => {
  const archive = archiveWith();
  renderPage(archive);

  fireEvent.change(await screen.findByLabelText('Organise by'), {
    target: { value: 'events' },
  });
  fireEvent.click(screen.getByLabelText('Camera'));
  await waitFor(() => {
    expect(archive.sites[0]?.presentation).toEqual({
      organiseBy: 'events',
      captions: ['title', 'camera'],
    });
  });
});

test('"Build site" waits while a change is being saved, so a build never uses old settings', async () => {
  const archive = archiveWith();
  renderPage(archive);
  const buildButton = await screen.findByRole('button', { name: 'Build site' });
  const release = archive.holdSiteUpdates();

  fireEvent.click(screen.getByLabelText('Camera'));

  await waitFor(() => {
    expect(buildButton).toHaveProperty('disabled', true);
  });
  release();
  await waitFor(() => {
    expect(buildButton).toHaveProperty('disabled', false);
  });
});
