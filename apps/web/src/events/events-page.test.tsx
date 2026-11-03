// @vitest-environment happy-dom
import { createApiClient } from '@filmfile/contracts/client';
import {
  createEventRequest,
  updateEventRequest,
  type Event,
} from '@filmfile/contracts/events';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { EventsPage } from './events-page.tsx';

afterEach(cleanup);

/** Answers like the backend: events with versions, listed newest first, and no rolls. */
function fakeService(events: Event[] = []) {
  const ifMatches: (string | null)[] = [];
  let version = 1;
  const etag = () => `"v${String(version)}"`;
  const changed = () => {
    version += 1;
  };
  const newestFirst = () =>
    [...events].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/rolls') {
      return Response.json({ rolls: [], unreadable: [] });
    }
    if (url.pathname === '/api/events') {
      if (request.method === 'GET') {
        return Response.json({ events: newestFirst() });
      }
      const { name, date } = createEventRequest.parse(await request.json());
      const event = {
        slug: name.toLowerCase().replace(/\W+/g, '-'),
        name,
        date: date ?? null,
      };
      events.push(event);
      return Response.json(event, { status: 201 });
    }
    const slug = url.pathname.split('/').at(-1);
    const index = events.findIndex((e) => e.slug === slug);
    const current = events[index];
    if (current === undefined) {
      return Response.json({ error: 'not found' }, { status: 404 });
    }
    if (request.method === 'GET') {
      return Response.json(current, { headers: { ETag: etag() } });
    }
    const ifMatch = request.headers.get('If-Match');
    ifMatches.push(ifMatch);
    if (ifMatch !== etag()) {
      return Response.json({ error: 'changed' }, { status: 409 });
    }
    const { name, date } = updateEventRequest.parse(await request.json());
    const updated = {
      ...current,
      ...(name === undefined ? {} : { name }),
      ...(date === undefined ? {} : { date }),
    };
    events[index] = updated;
    changed();
    return Response.json(updated, { headers: { ETag: etag() } });
  }

  return { answer, events, ifMatches, changed };
}

function renderPage(service: { answer: (r: Request) => Promise<Response> }) {
  const api = createApiClient({
    baseUrl: 'http://localhost',
    fetch: service.answer,
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EventsPage api={api} />
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

test('lists the events newest first, each with its date', async () => {
  renderPage(
    fakeService([
      { slug: 'westfjords', name: 'Westfjords', date: '2025-06' },
      { slug: 'iceland-2026', name: 'Iceland 2026', date: '2026-09-12' },
      { slug: 'undated', name: 'Undated', date: null },
    ]),
  );

  await screen.findByText('Westfjords');
  expect(eventsListed()).toEqual([
    'Iceland 2026 · 12 Sep 20260 rollsEdit',
    'Westfjords · Jun 20250 rollsEdit',
    'Undated0 rollsEdit',
  ]);
});

test('says how to add the first event', async () => {
  renderPage(fakeService());

  expect(
    await screen.findByText('No events yet. Add one with New event.'),
  ).toBeDefined();
});

test('adds a new event with its name and date', async () => {
  const service = fakeService();
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
  const service = fakeService();
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
  const service = fakeService([
    { slug: 'iceland', name: 'Iceland', date: null },
  ]);
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
  const service = fakeService([
    { slug: 'iceland', name: 'Iceland', date: null },
  ]);
  renderPage(service);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Iceland' }));
  const form = await screen.findByRole('form', { name: 'Edit Iceland' });
  service.changed();

  fill(form, 'Name', 'Iceland 2026');
  fireEvent.click(within(form).getByRole('button', { name: 'Save event' }));

  expect((await within(form).findByRole('alert')).textContent).toBe(
    'This event changed since you opened it. Cancel and edit it again.',
  );
  expect(service.events[0]?.name).toBe('Iceland');
});
