// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
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
function anArchive(): FakeArchive {
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
  renderPage(anArchive());

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

test('groups the frames by roll, each group leading to its roll, kept in the address', async () => {
  renderPage(anArchive());
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
  renderPage(anArchive());

  await screen.findByText('3 frames');
  expect(
    screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
  ).toEqual(['Nikon FE 1 frame', 'No camera 2 frames']);
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
