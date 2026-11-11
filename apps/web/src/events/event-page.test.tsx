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
import { afterEach, beforeEach, expect, test } from 'vitest';
import {
  aFrame,
  aRoll,
  fakeArchive,
  type FakeArchive,
} from '../testing/fake-archive.ts';
import { EventPage } from './event-page.tsx';

beforeEach(() => {
  window.history.replaceState(null, '', '/events/iceland-2026');
});

afterEach(cleanup);

const iceland = { slug: 'iceland-2026', name: 'Iceland 2026', date: '2026-09' };

/** Two rolls at Iceland 2026, shot in this order, and one roll elsewhere. */
function aSettings(): FakeArchive {
  return fakeArchive({
    events: [iceland],
    cameras: [{ slug: 'nikon-fe', make: 'Nikon', model: 'FE' }],
    rolls: [
      aRoll('2026-014', {
        event: 'iceland-2026',
        shot: '2026-09-14',
        frames: [aFrame('2', '12340002.jpg'), aFrame('1', '12340001.jpg')],
      }),
      aRoll('2026-012', {
        event: 'iceland-2026',
        shot: '2026-09-12',
        camera: 'nikon-fe',
        frames: [aFrame('36', '56780036.jpg')],
      }),
      aRoll('2026-020', { frames: [aFrame('1', '99990001.jpg')] }),
    ],
  });
}

function renderPage(archive: FakeArchive, slug = 'iceland-2026') {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EventPage api={archive.api} slug={slug} />
    </QueryClientProvider>,
  );
}

/** Each frame shown, as "frame number on roll number", in order. */
function framesShown(): string[] {
  return screen
    .getAllByRole('listitem')
    .map((item) => item.getAttribute('aria-label') ?? '');
}

test('shows the event, then the frames of all its rolls, in shot order', async () => {
  renderPage(aSettings());

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Iceland 2026' }),
  ).toBeDefined();
  expect(screen.getByText('Sep 2026')).toBeDefined();
  expect(await screen.findByText('3 frames')).toBeDefined();
  expect(framesShown()).toEqual([
    'Frame 36 of roll 2026-012',
    'Frame 1 of roll 2026-014',
    'Frame 2 of roll 2026-014',
  ]);
  expect(
    screen.getAllByRole('img').map((img) => img.getAttribute('alt')),
  ).toEqual(['56780036.jpg', '12340001.jpg', '12340002.jpg']);
});

test('shows each frame’s rating and marks on its thumbnail, as the roll page does', async () => {
  const [first, second] = [
    aFrame('1', '12340001.jpg'),
    aFrame('2', '12340002.jpg'),
  ];
  const [scan] = second.versions;
  renderPage(
    fakeArchive({
      events: [iceland],
      rolls: [
        aRoll('2026-014', {
          event: 'iceland-2026',
          shot: '2026-09-14',
          frames: [
            { ...first, rating: 5, notes: 'Lens cap half on' },
            {
              ...second,
              versions: scan === undefined ? [] : [scan, { ...scan, id: 'v2' }],
            },
          ],
        }),
      ],
    }),
  );

  const [one, two] = await screen.findAllByRole('listitem');
  expect(within(one ?? document.body).getByText('Rated 5 of 5')).toBeDefined();
  expect(within(one ?? document.body).getByText('Has notes')).toBeDefined();
  expect(within(one ?? document.body).queryByText('2 versions')).toBeNull();
  expect(within(two ?? document.body).getByText('2 versions')).toBeDefined();
  expect(within(two ?? document.body).queryByText(/^Rated/)).toBeNull();
});

test('groups the frames by roll, each group leading to its roll, kept in the address', async () => {
  renderPage(aSettings());
  await screen.findByText('3 frames');

  fireEvent.change(screen.getByLabelText('Group by'), {
    target: { value: 'roll' },
  });

  const groups = screen.getAllByRole('heading', { level: 2 });
  expect(groups.map((heading) => heading.textContent)).toEqual([
    '2026-012 1 frame',
    '2026-014 2 frames',
  ]);
  expect(
    within(groups[0] ?? document.body)
      .getByRole('link', { name: '2026-012' })
      .getAttribute('href'),
  ).toBe(`/rolls/${aRoll('2026-012').id}`);
  expect(window.location.search).toBe('?group=roll');
});

test('groups the frames by camera, with frames whose roll has none last', async () => {
  window.history.replaceState(null, '', '/events/iceland-2026?group=camera');
  renderPage(aSettings());

  await screen.findByText('3 frames');
  expect(
    screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
  ).toEqual(['Nikon FE 1 frame', 'No camera 2 frames']);
});

test('a camera group leads to the rolls shot on it, and each frame to its roll', async () => {
  window.history.replaceState(null, '', '/events/iceland-2026?group=camera');
  renderPage(aSettings());
  await screen.findByText('3 frames');

  const [nikon, none] = screen.getAllByRole('heading', { level: 2 });
  expect(
    within(nikon ?? document.body)
      .getByRole('link', { name: 'Nikon FE' })
      .getAttribute('href'),
  ).toBe('/?camera=nikon-fe');
  expect(within(none ?? document.body).queryByRole('link')).toBeNull();

  const [first] = screen.getAllByRole('listitem');
  expect(
    within(first ?? document.body)
      .getByRole('link', { name: '2026-012' })
      .getAttribute('href'),
  ).toBe(`/rolls/${aRoll('2026-012').id}`);
});

test('leaves out hidden frames, counting them, until they are shown from the Actions menu', async () => {
  const base = aSettings();
  const [first, second] = base.rolls;
  const archive = fakeArchive({
    events: [iceland],
    rolls: [
      {
        ...(first ?? aRoll('x')),
        frames: (first?.frames ?? []).map((frame, i) => ({
          ...frame,
          hidden: i === 0,
        })),
      },
      ...(second === undefined ? [] : [second]),
    ],
  });
  renderPage(archive);

  expect(await screen.findByText('2 frames (1 hidden)')).toBeDefined();
  expect(framesShown()).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Show hidden frames' }));

  expect(window.location.search).toBe('?hidden=show');
});

test('shows frames put in the event themselves, and leaves out frames of its rolls put elsewhere', async () => {
  renderPage(
    fakeArchive({
      events: [iceland],
      rolls: [
        aRoll('2026-014', {
          event: 'iceland-2026',
          shot: '2026-09-14',
          frames: [
            aFrame('1', '12340001.jpg'),
            { ...aFrame('2', '12340002.jpg'), event: 'westfjords' },
          ],
        }),
        aRoll('2026-020', {
          shot: '2026-09-20',
          frames: [
            aFrame('1', '99990001.jpg'),
            { ...aFrame('2', '99990002.jpg'), event: 'iceland-2026' },
          ],
        }),
      ],
    }),
  );

  expect(await screen.findByText('2 frames')).toBeDefined();
  expect(framesShown()).toEqual([
    'Frame 1 of roll 2026-014',
    'Frame 2 of roll 2026-020',
  ]);
});

test('puts frames in order by their own date where they have one', async () => {
  renderPage(
    fakeArchive({
      events: [iceland],
      rolls: [
        aRoll('2026-014', {
          event: 'iceland-2026',
          shot: '2026-09-14',
          frames: [
            aFrame('1', '12340001.jpg'),
            { ...aFrame('2', '12340002.jpg'), shot: '2026-09-20' },
          ],
        }),
        aRoll('2026-015', {
          event: 'iceland-2026',
          shot: '2026-09-16',
          frames: [aFrame('1', '56780001.jpg')],
        }),
      ],
    }),
  );

  expect(await screen.findByText('3 frames')).toBeDefined();
  expect(framesShown()).toEqual([
    'Frame 1 of roll 2026-014',
    'Frame 1 of roll 2026-015',
    'Frame 2 of roll 2026-014',
  ]);
});

test('groups frames by their own camera where they have one', async () => {
  window.history.replaceState(null, '', '/events/iceland-2026?group=camera');
  renderPage(
    fakeArchive({
      events: [iceland],
      cameras: [
        { slug: 'nikon-fe', make: 'Nikon', model: 'FE' },
        { slug: 'leica-m6', make: 'Leica', model: 'M6' },
      ],
      rolls: [
        aRoll('2026-014', {
          event: 'iceland-2026',
          camera: 'nikon-fe',
          frames: [
            aFrame('1', '12340001.jpg'),
            { ...aFrame('2', '12340002.jpg'), camera: 'leica-m6' },
          ],
        }),
      ],
    }),
  );

  await screen.findByText('2 frames');
  expect(
    screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
  ).toEqual(['Leica M6 1 frame', 'Nikon FE 1 frame']);
});

test('says when the event has no frames yet', async () => {
  renderPage(fakeArchive({ events: [iceland] }));

  expect(
    await screen.findByText(
      'No frames yet. Put rolls in this event from their details.',
    ),
  ).toBeDefined();
});

test('says when there is no such event', async () => {
  renderPage(fakeArchive(), 'nowhere');

  expect(await screen.findByText('There is no such event.')).toBeDefined();
});

test('rates a frame from its thumbnail, against its own roll, and shows it at once (FF-149)', async () => {
  const archive = aSettings();
  renderPage(archive);
  const item = await screen.findByRole('listitem', {
    name: 'Frame 36 of roll 2026-012',
  });

  fireEvent.click(within(item).getByRole('button', { name: 'Rate 4 stars' }));

  expect(await within(item).findByText('Rated 4 of 5')).toBeDefined();
  await waitFor(() => {
    expect(
      archive.rolls.find((roll) => roll.roll === '2026-012')?.frames[0]?.rating,
    ).toBe(4);
  });
  // The other roll wasn't touched, and the page stayed where it was.
  expect(
    archive.rolls
      .find((roll) => roll.roll === '2026-014')
      ?.frames.every((frame) => frame.rating === null),
  ).toBe(true);
  expect(window.location.pathname).toBe('/events/iceland-2026');
});

test('says so when a rating can’t be saved, and keeps the frame as it was (FF-149)', async () => {
  const archive = aSettings();
  renderPage(archive);
  const item = await screen.findByRole('listitem', {
    name: 'Frame 36 of roll 2026-012',
  });
  archive.failSaves();

  fireEvent.click(within(item).getByRole('button', { name: 'Rate 4 stars' }));

  expect((await screen.findByRole('alert')).textContent).toBe(
    "Couldn't save the rating. Is the service running?",
  );
  expect(within(item).queryByText('Rated 4 of 5')).toBeNull();
});

test('has an Edit button that opens the form for the event, and renames it, showing the new name (FF-169)', async () => {
  const archive = aSettings();
  renderPage(archive);

  fireEvent.click(
    await screen.findByRole('button', { name: 'Edit Iceland 2026' }),
  );
  const form = await screen.findByRole('form', { name: 'Edit Iceland 2026' });
  fireEvent.change(within(form).getByLabelText('Name', { exact: false }), {
    target: { value: 'Iceland, September' },
  });
  fireEvent.click(within(form).getByRole('button', { name: 'Save event' }));

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Iceland, September',
    }),
  ).toBeDefined();
  expect(archive.events[0]?.name).toBe('Iceland, September');
  expect(archive.ifMatches).toEqual(['"v1"']);
  // The form closes and the Edit button is back.
  expect(screen.queryByRole('form')).toBeNull();
  expect(
    await screen.findByRole('button', { name: 'Edit Iceland, September' }),
  ).toBeDefined();
});

test('closes the event form on Cancel, changing nothing', async () => {
  const archive = aSettings();
  renderPage(archive);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Edit Iceland 2026' }),
  );
  const form = await screen.findByRole('form', { name: 'Edit Iceland 2026' });

  fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));

  expect(screen.queryByRole('form')).toBeNull();
  expect(archive.events[0]?.name).toBe('Iceland 2026');
  expect(
    screen.getByRole('button', { name: 'Edit Iceland 2026' }),
  ).toBeDefined();
});

test('refuses to overwrite an event changed since it was opened', async () => {
  const archive = aSettings();
  renderPage(archive);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Edit Iceland 2026' }),
  );
  const form = await screen.findByRole('form', { name: 'Edit Iceland 2026' });
  archive.changeEvent('iceland-2026');

  fireEvent.click(within(form).getByRole('button', { name: 'Save event' }));

  expect((await within(form).findByRole('alert')).textContent).toBe(
    'This event changed since you opened it. Cancel and edit it again.',
  );
});
