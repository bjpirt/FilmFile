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
  selection: { rules: [], pinned: [], hidden: [] },
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

const lastUpdate = (archive: FakeArchive) => archive.siteUpdates.at(-1)?.body;

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

  fireEvent.click(screen.getByLabelText('Group by'));
  fireEvent.change(screen.getByLabelText('Group by'), {
    target: { value: 'roll' },
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

test('shows how the site is presented: the title shown is its name until changed', async () => {
  renderPage(archiveWith());

  const title = await screen.findByLabelText<HTMLInputElement>('Page title');
  expect(title.value).toBe('');
  expect(title.placeholder).toBe('Iceland');
  expect(screen.getByLabelText<HTMLSelectElement>('Group by').value).toBe(
    'nothing',
  );
  expect(screen.getByLabelText<HTMLInputElement>('Title').checked).toBe(true);
  expect(screen.getByLabelText<HTMLInputElement>('Camera').checked).toBe(false);
});

test('saves the title and the intro when you leave them, and a choice at once', async () => {
  const archive = archiveWith();
  renderPage(archive);

  const title = await screen.findByLabelText('Page title');
  fireEvent.change(title, { target: { value: 'Iceland, in September' } });
  expect(lastUpdate(archive)).toBeUndefined();
  fireEvent.blur(title);
  await waitFor(() => {
    expect(lastUpdate(archive)).toMatchObject({
      presentation: { title: 'Iceland, in September' },
    });
  });

  fireEvent.change(screen.getByLabelText('Intro'), {
    target: { value: 'Two weeks.' },
  });
  fireEvent.blur(screen.getByLabelText('Intro'));
  await waitFor(() => {
    expect(lastUpdate(archive)).toMatchObject({
      presentation: { title: 'Iceland, in September', intro: 'Two weeks.' },
    });
  });

  fireEvent.change(screen.getByLabelText('Group by'), {
    target: { value: 'event' },
  });
  fireEvent.click(screen.getByLabelText('Camera'));
  await waitFor(() => {
    expect(archive.sites[0]?.presentation).toEqual({
      title: 'Iceland, in September',
      intro: 'Two weeks.',
      groupBy: 'event',
      captions: ['title', 'camera'],
    });
  });
});

test('an emptied title goes back to the site’s name', async () => {
  const archive = archiveWith({
    sites: [
      {
        ...aSite,
        presentation: {
          title: 'Iceland, in September',
          intro: '',
          groupBy: 'nothing',
          captions: ['title'],
        },
      },
    ],
  });
  renderPage(archive);

  const title = await screen.findByLabelText('Page title');
  fireEvent.change(title, { target: { value: '' } });
  fireEvent.blur(title);

  await waitFor(() => {
    expect(archive.sites[0]?.presentation.title).toBeNull();
  });
});
