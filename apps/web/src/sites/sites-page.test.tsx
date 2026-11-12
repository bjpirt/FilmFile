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
import { SitesPage } from './sites-page.tsx';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

function renderPage(archive: FakeArchive) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SitesPage api={archive.api} />
    </QueryClientProvider>,
  );
}

const emptySelection = { rules: [], excluded: [] };

test('lists the sites by name, each with how many frames are on it', async () => {
  const roll = aRoll('2026-001', {
    frames: [aFrame('1', '12340001.jpg'), aFrame('2', '12340002.jpg')],
  });
  const frame = roll.frames[0];
  renderPage(
    fakeArchive({
      rolls: [roll],
      sites: [
        {
          id: 'S2',
          slug: 'westfjords',
          name: 'Westfjords',
          selection: emptySelection,
        },
        {
          id: 'S1',
          slug: 'iceland',
          name: 'Iceland',
          selection: {
            ...emptySelection,
            excluded: [{ rollId: roll.id, frameId: frame?.id ?? '' }],
          },
        },
      ],
    }),
  );

  const items = await screen.findAllByRole('listitem');

  expect(items.map((item) => item.textContent)).toEqual([
    'Iceland 1 frame',
    'Westfjords 2 frames',
  ]);
  expect(
    screen.getByRole('link', { name: 'Iceland' }).getAttribute('href'),
  ).toBe('/sites/iceland');
});

test('says there are none yet, with a button to make one', async () => {
  renderPage(fakeArchive());

  expect(
    await screen.findByText('No sites yet. Make one to share a set of frames.'),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'New site' })).toBeTruthy();
});

test('asks for a name, makes the site and opens its page', async () => {
  const archive = fakeArchive();
  renderPage(archive);
  fireEvent.click(await screen.findByRole('button', { name: 'New site' }));

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Iceland highlights' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add site' }));

  await waitFor(() => {
    expect(window.location.pathname).toBe('/sites/iceland-highlights');
  });
  expect(archive.sites.map((site) => site.name)).toEqual([
    'Iceland highlights',
  ]);
});

test('says so when another site has a name like it', async () => {
  const archive = fakeArchive({
    sites: [
      { id: 'S1', slug: 'iceland', name: 'Iceland', selection: emptySelection },
    ],
  });
  renderPage(archive);
  fireEvent.click(await screen.findByRole('button', { name: 'New site' }));

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'iceland' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add site' }));

  expect((await screen.findByRole('alert')).textContent).toBe(
    "There's already a site with a name like iceland.",
  );
  expect(window.location.pathname).toBe('/');
});

test('asks for a name when none is entered', async () => {
  renderPage(fakeArchive());
  fireEvent.click(await screen.findByRole('button', { name: 'New site' }));

  fireEvent.click(screen.getByRole('button', { name: 'Add site' }));

  expect((await screen.findByRole('alert')).textContent).toContain(
    'Enter a name for the site',
  );
});

test('says the service may not be running when the sites cannot be loaded', async () => {
  const archive = fakeArchive();
  archive.stop();
  renderPage(archive);

  expect(
    await screen.findByText("Couldn't load the sites. Is the service running?"),
  ).toBeTruthy();
});
