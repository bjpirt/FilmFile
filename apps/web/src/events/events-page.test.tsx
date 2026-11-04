// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import {
  aFrame,
  aRoll,
  fakeArchive,
  type FakeArchive,
} from '../testing/fake-archive.ts';
import { EventsPage } from './events-page.tsx';

afterEach(cleanup);

function renderPage(archive: FakeArchive) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EventsPage api={archive.api} />
    </QueryClientProvider>,
  );
}

/** A field by its label, ignoring the required marker, within a form. */
function fieldIn(form: HTMLElement, label: string): HTMLInputElement {
  return within(form).getByLabelText<HTMLInputElement>(label, {
    normalizer: (text) => text.replace('*', '').trim(),
  });
}

function fill(form: HTMLElement, label: string, value: string) {
  fireEvent.change(fieldIn(form, label), { target: { value } });
}

function eventsListed(): (string | null)[] {
  return screen.getAllByRole('listitem').map((item) => item.textContent);
}

test('lists the events newest first, each as a card with its counts and date', async () => {
  renderPage(
    fakeArchive({
      events: [
        { slug: 'westfjords', name: 'Westfjords', date: '2025-06' },
        { slug: 'iceland-2026', name: 'Iceland 2026', date: '2026-09-12' },
        { slug: 'undated', name: 'Undated', date: null },
      ],
    }),
  );

  await screen.findByText('Westfjords');
  expect(eventsListed()).toEqual([
    'Iceland 20260 rolls · 0 photos · 12 Sep 2026Edit',
    'Westfjords0 rolls · 0 photos · Jun 2025Edit',
    'Undated0 rolls · 0 photosEdit',
  ]);
  expect(
    screen.getByRole('link', { name: 'Westfjords' }).getAttribute('href'),
  ).toBe('/events/westfjords');
});

test('counts the rolls and photos in an event, through their frames too', async () => {
  renderPage(
    fakeArchive({
      events: [{ slug: 'westfjords', name: 'Westfjords', date: '2025-06' }],
      rolls: [
        aRoll('2025-003', {
          event: 'westfjords',
          frames: [
            aFrame('1', '56780001.jpg'),
            { ...aFrame('2', '56780002.jpg'), events: ['puffins'] },
          ],
        }),
        aRoll('2025-004', {
          frames: [{ ...aFrame('1', '12340001.jpg'), events: ['westfjords'] }],
        }),
        aRoll('2025-005'),
      ],
    }),
  );

  expect(
    await screen.findByText('2 rolls · 2 photos · Jun 2025'),
  ).toBeDefined();
});

test('says how to add the first event', async () => {
  renderPage(fakeArchive());

  expect(
    await screen.findByText('No events yet. Add one with New event.'),
  ).toBeDefined();
});

test('adds a new event with its name and date', async () => {
  const service = fakeArchive();
  renderPage(service);
  fireEvent.click(await screen.findByRole('button', { name: 'New event' }));

  const form = screen.getByRole('form', { name: 'New event' });
  fill(form, 'Name', 'Iceland 2026');
  fill(form, 'Year', '2026');
  fill(form, 'Month', '09');
  fireEvent.click(within(form).getByRole('button', { name: 'Add event' }));

  expect(await screen.findByText('Iceland 2026')).toBeDefined();
  expect(screen.queryByRole('form', { name: 'New event' })).toBeNull();
  expect(service.events).toEqual([
    { slug: 'iceland-2026', name: 'Iceland 2026', date: '2026-09' },
  ]);
});

test('asks for a new event’s name', async () => {
  const service = fakeArchive();
  renderPage(service);
  fireEvent.click(await screen.findByRole('button', { name: 'New event' }));

  const form = screen.getByRole('form', { name: 'New event' });
  fireEvent.click(within(form).getByRole('button', { name: 'Add event' }));

  expect(screen.getByRole('alert').textContent).toBe(
    'Enter a name for the event, like Iceland 2026.',
  );
  expect(service.events).toEqual([]);
});

test('renames an event and changes its date, sending its ETag', async () => {
  const service = fakeArchive({
    events: [{ slug: 'iceland', name: 'Iceland', date: null }],
  });
  renderPage(service);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Iceland' }));

  const form = await screen.findByRole('form', { name: 'Edit Iceland' });
  expect(fieldIn(form, 'Name').value).toBe('Iceland');
  fill(form, 'Name', 'Iceland 2026');
  fill(form, 'Year', '2026');
  fireEvent.click(within(form).getByRole('button', { name: 'Save event' }));

  expect(await screen.findByText('Iceland 2026')).toBeDefined();
  expect(service.events).toEqual([
    { slug: 'iceland', name: 'Iceland 2026', date: '2026' },
  ]);
  expect(service.ifMatches).toEqual(['"v1"']);
});

test('refuses to overwrite an event changed since it was opened', async () => {
  const service = fakeArchive({
    events: [{ slug: 'iceland', name: 'Iceland', date: null }],
  });
  renderPage(service);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Iceland' }));
  const form = await screen.findByRole('form', { name: 'Edit Iceland' });
  service.changeEvent('iceland');

  fill(form, 'Name', 'Iceland 2026');
  fireEvent.click(within(form).getByRole('button', { name: 'Save event' }));

  expect((await within(form).findByRole('alert')).textContent).toBe(
    'This event changed since you opened it. Cancel and edit it again.',
  );
  expect(service.events[0]?.name).toBe('Iceland');
});
