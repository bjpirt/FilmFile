// @vitest-environment happy-dom
import { createApiClient } from '@filmfile/contracts/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { App } from './app.tsx';

const roll = {
  id: '01JC8Z7K3M0000000000000001',
  roll: '2026-014',
  name: null,
  description: null,
  shot: null,
  frames: [],
};

beforeEach(() => {
  window.history.pushState(null, '', '/');
  localStorage.clear();
});

afterEach(cleanup);

function renderApp() {
  const api = createApiClient({
    baseUrl: 'http://localhost',
    fetch: (request) =>
      Promise.resolve(
        Response.json(
          request.url.endsWith('/api/rolls')
            ? { rolls: [roll], unreadable: [] }
            : roll,
        ),
      ),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App api={api} />
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

test('says when a page does not exist', () => {
  window.history.pushState(null, '', '/nowhere');

  renderApp();

  expect(screen.getByText('There is no page here.')).toBeDefined();
});
