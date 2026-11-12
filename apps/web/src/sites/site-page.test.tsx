// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

function renderPage(archive: FakeArchive, slug = 'iceland') {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SitePage api={archive.api} slug={slug} />
    </QueryClientProvider>,
  );
}

const lastUpdate = (archive: FakeArchive) => archive.siteUpdates.at(-1)?.body;

test('shows the site’s name, its rule editor, how many frames match and the frames', async () => {
  renderPage(archiveWith());

  expect(
    (await screen.findByRole('heading', { name: 'Iceland' })).textContent,
  ).toBe('Iceland');
  expect(await screen.findByText('2 frames match')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add a rule ▾' })).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'Roll 2026-001, frame 2' }),
  ).toBeTruthy();
});

test('shows the rules the site already has', async () => {
  renderPage(
    archiveWith({
      sites: [
        {
          ...aSite,
          selection: {
            rules: [{ kind: 'rating', atLeast: 5 }],
            pinned: [],
            hidden: [],
          },
        },
      ],
    }),
  );

  const rating =
    await screen.findByLabelText<HTMLSelectElement>('Rated at least');
  expect(rating.value).toBe('5');
});

test('saves a rule straight away, against the version it was opened at', async () => {
  const archive = archiveWith();
  renderPage(archive);
  await screen.findByText('2 frames match');

  fireEvent.click(screen.getByRole('button', { name: 'Add a rule ▾' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rated at least' }));

  await waitFor(() => {
    expect(lastUpdate(archive)).toEqual({
      selection: {
        rules: [{ kind: 'rating', atLeast: 4 }],
        pinned: [],
        hidden: [],
      },
    });
  });
  expect(archive.ifMatches).toEqual(['"v1"']);
  // Saved quietly, as the rest of the app saves; only a failure is said.
  expect(screen.queryByText('Saved')).toBeNull();
  expect(screen.queryByText('Saving…')).toBeNull();
});

test('each change is saved against the version the last one left', async () => {
  const archive = archiveWith();
  renderPage(archive);
  await screen.findByText('2 frames match');

  fireEvent.click(screen.getByRole('button', { name: 'Add a rule ▾' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rated at least' }));
  await screen.findByLabelText('Rated at least');
  fireEvent.change(screen.getByLabelText('Rated at least'), {
    target: { value: '2' },
  });

  await waitFor(() => {
    expect(archive.siteUpdates).toHaveLength(2);
  });
  expect(archive.ifMatches).toEqual(['"v1"', '"v2"']);
  expect(archive.sites[0]?.selection.rules).toEqual([
    { kind: 'rating', atLeast: 2 },
  ]);
});

test('"Always include" pins a frame and "Never include" leaves another off, each saved', async () => {
  const archive = archiveWith();
  renderPage(archive);
  await screen.findByText('2 frames match');

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Always include Roll 2026-001, frame 1',
    }),
  );
  await screen.findByText('Always included');
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Never include Roll 2026-001, frame 2',
    }),
  );

  await waitFor(() => {
    expect(screen.getByText('1 frame matches')).toBeTruthy();
  });
  expect(archive.sites[0]?.selection).toMatchObject({
    pinned: [{ frameId: '01JC8Z7K3M00000000000F0001' }],
    hidden: [{ frameId: '01JC8Z7K3M00000000000F0002' }],
  });
});

test('a frame pinned can be un-pinned from the frame itself', async () => {
  const archive = archiveWith();
  renderPage(archive);
  await screen.findByText('2 frames match');
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Always include Roll 2026-001, frame 1',
    }),
  );

  fireEvent.click(
    await screen.findByRole('button', {
      name: "Don't always include Roll 2026-001, frame 1",
    }),
  );

  await waitFor(() => {
    expect(screen.queryByText('Always included')).toBeNull();
  });
  expect(archive.sites[0]?.selection.pinned).toEqual([]);
});

test('lists the frames left off as "Hidden: 1", each with a way to put it back', async () => {
  const archive = archiveWith({
    sites: [
      {
        ...aSite,
        selection: {
          rules: [],
          pinned: [],
          hidden: [
            {
              rollId: '01JC8Z7K3M0000000002026001',
              frameId: '01JC8Z7K3M00000000000F0002',
            },
          ],
        },
      },
    ],
  });
  renderPage(archive);

  expect(await screen.findByText('Hidden: 1')).toBeTruthy();
  expect(await screen.findByText('1 frame matches')).toBeTruthy();
  const hidden = screen.getByRole('region', { name: 'Frames left off' });
  fireEvent.click(
    within(hidden).getByRole('button', {
      name: 'Put back Roll 2026-001, frame 2',
    }),
  );

  await waitFor(() => {
    expect(screen.queryByText(/^Hidden:/)).toBeNull();
  });
  expect(await screen.findByText('2 frames match')).toBeTruthy();
  expect(archive.sites[0]?.selection.hidden).toEqual([]);
});

test('renames the site, and the address follows its new slug', async () => {
  const archive = archiveWith();
  window.history.replaceState(null, '', '/sites/iceland');
  renderPage(archive);
  await screen.findByText('2 frames match');

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Iceland 2026' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

  await waitFor(() => {
    expect(window.location.pathname).toBe('/sites/iceland-2026');
  });
  expect(archive.sites.map((site) => site.slug)).toEqual(['iceland-2026']);
});

test('says so when another site already has the new name, saving nothing', async () => {
  const archive = archiveWith({
    sites: [aSite, { ...aSite, id: 'S2', slug: 'norway', name: 'Norway' }],
  });
  renderPage(archive);
  await screen.findByText('2 frames match');

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Norway' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

  expect((await screen.findByRole('alert')).textContent).toBe(
    "There's already a site with a name like Norway.",
  );
  expect(archive.sites.map((site) => site.slug)).toEqual(['iceland', 'norway']);
});

test('says the site changed elsewhere, keeps what is on screen, and sends nothing more', async () => {
  const archive = archiveWith();
  renderPage(archive);
  await screen.findByText('2 frames match');
  archive.changeSite('iceland');

  fireEvent.click(screen.getByRole('button', { name: 'Add a rule ▾' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rated at least' }));

  expect((await screen.findByRole('alert')).textContent).toBe(
    'This site changed since you opened it. Reload the page.',
  );
  expect(screen.getByLabelText('Rated at least')).toBeTruthy();
  expect(archive.sites[0]?.selection.rules).toEqual([]);

  fireEvent.change(screen.getByLabelText('Rated at least'), {
    target: { value: '2' },
  });
  await screen.findByRole('alert');
  expect(archive.ifMatches).toHaveLength(1);
});

test('says so when the site cannot be saved', async () => {
  const archive = archiveWith();
  renderPage(archive);
  await screen.findByText('2 frames match');
  archive.failSaves();

  fireEvent.click(screen.getByRole('button', { name: 'Add a rule ▾' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Has a Final' }));

  expect((await screen.findByRole('alert')).textContent).toBe(
    "Couldn't save the site. Is the service running?",
  );
});

test('asks "Delete site Iceland?", then deletes it and goes to the sites', async () => {
  const archive = archiveWith();
  window.history.replaceState(null, '', '/sites/iceland');
  renderPage(archive);
  await screen.findByText('2 frames match');

  fireEvent.click(screen.getByRole('button', { name: 'Delete site…' }));
  expect(screen.getByText('Delete site Iceland?')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Delete site' }));

  await waitFor(() => {
    expect(window.location.pathname).toBe('/sites');
  });
  expect(archive.sites).toEqual([]);
});

test('Cancel leaves the site as it is', async () => {
  const archive = archiveWith();
  renderPage(archive);
  await screen.findByText('2 frames match');
  fireEvent.click(screen.getByRole('button', { name: 'Delete site…' }));

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.queryByText('Delete site Iceland?')).toBeNull();
  expect(archive.sites).toHaveLength(1);
});

test('says there is no such site', async () => {
  renderPage(archiveWith(), 'nothing');

  expect(await screen.findByText('There is no such site.')).toBeTruthy();
});
