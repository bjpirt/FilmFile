// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { App } from './app.tsx';
import { aRoll, fakeArchive } from './testing/fake-archive.ts';

const roll = aRoll('2026-014', { event: 'iceland-2026' });

beforeEach(() => {
  window.history.pushState(null, '', '/');
  localStorage.clear();
});

afterEach(cleanup);

function renderApp() {
  const archive = fakeArchive({
    rolls: [roll],
    events: [{ slug: 'iceland-2026', name: 'Iceland 2026', date: '2026-09' }],
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App api={archive.api} />
    </QueryClientProvider>,
  );
}

test('opens a roll from the list of rolls, and goes back', async () => {
  renderApp();

  fireEvent.click(await screen.findByRole('link', { name: '2026-014' }));

  expect(window.location.pathname).toBe(`/rolls/${roll.id}`);
  expect(
    await screen.findByRole('heading', { name: 'Roll 2026-014' }),
  ).toBeDefined();

  fireEvent.click(screen.getByRole('link', { name: 'All rolls' }));

  expect(await screen.findByRole('heading', { name: 'Rolls' })).toBeDefined();
});

test('opens the roll in the address bar', async () => {
  window.history.pushState(null, '', `/rolls/${roll.id}`);

  renderApp();

  expect(
    await screen.findByRole('heading', { name: 'Roll 2026-014' }),
  ).toBeDefined();
});

test('hides and shows the browse panel from the header', async () => {
  renderApp();
  await screen.findByRole('complementary', { name: 'Browse rolls' });

  fireEvent.click(
    screen.getByRole('button', { name: 'Hide the browse panel' }),
  );

  expect(screen.queryByRole('complementary')).toBeNull();

  fireEvent.click(
    screen.getByRole('button', { name: 'Show the browse panel' }),
  );

  expect(
    screen.getByRole('complementary', { name: 'Browse rolls' }),
  ).toBeDefined();
});

test('lists the events from the header, with their rolls, and opens an event’s rolls', async () => {
  renderApp();

  fireEvent.click(screen.getByRole('link', { name: 'Events' }));

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Events' }),
  ).toBeDefined();
  const event = await screen.findByRole('listitem');
  expect(event.textContent).toBe('Iceland 2026 · Sep 20261 rollEdit');

  fireEvent.click(screen.getByRole('link', { name: 'Iceland 2026' }));

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Rolls at Iceland 2026',
    }),
  ).toBeDefined();
});

test('says when a page does not exist', () => {
  window.history.pushState(null, '', '/nowhere');

  renderApp();

  expect(screen.getByText('There is no page here.')).toBeDefined();
});
