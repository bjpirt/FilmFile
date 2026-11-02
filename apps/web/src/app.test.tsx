// @vitest-environment happy-dom
import { createApiClient } from '@filmfile/contracts/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from './app.tsx';

afterEach(cleanup);

function renderWithService(answer: () => Response) {
  const api = createApiClient({
    baseUrl: 'http://localhost',
    fetch: () => Promise.resolve(answer()),
  });
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queries}>
      <App api={api} />
    </QueryClientProvider>,
  );
}

test('says it is connected when the service is up', async () => {
  renderWithService(() => Response.json({ status: 'ok' }));

  expect(await screen.findByText('Connected to the service.')).toBeDefined();
});

test('says so when the service is not answering', async () => {
  renderWithService(() => new Response('', { status: 502 }));

  expect(
    await screen.findByText('The service is not responding.'),
  ).toBeDefined();
});
