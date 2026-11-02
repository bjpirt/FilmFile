// @vitest-environment happy-dom
import { createApiClient } from '@filmfile/contracts/client';
import type { Roll } from '@filmfile/contracts/rolls';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { RollsPage } from './rolls-page.tsx';

afterEach(cleanup);

/** Answers the rolls endpoints the way the backend does, keeping rolls in memory. */
function fakeRollsService(rolls: Roll[] = []) {
  let nextId = 0;
  return async (request: Request): Promise<Response> => {
    if (request.method === 'GET') {
      return Response.json(rolls);
    }
    const body: unknown = await request.json();
    const roll =
      typeof body === 'object' && body !== null && 'roll' in body
        ? String(body.roll)
        : '';
    if (!/^\d{4}-\d{3}$/.test(roll)) {
      return Response.json(
        {
          error: 'invalid request',
          issues: [
            { path: ['roll'], message: 'must be a roll number like 2026-014' },
          ],
        },
        { status: 422 },
      );
    }
    if (rolls.some((r) => r.roll === roll)) {
      return Response.json(
        { error: `roll ${roll} already exists` },
        { status: 409 },
      );
    }
    nextId += 1;
    const created = {
      id: `01JC8Z7K3M00000000000000${String(nextId).padStart(2, '0')}`,
      roll,
      frames: [],
    };
    rolls.push(created);
    return Response.json(created, { status: 201 });
  };
}

function aRoll(roll: string, frames = 0): Roll {
  return {
    id: '01JC8Z7K3M0000000000000099',
    roll,
    frames: Array.from({ length: frames }, (_, i) => ({
      id: `01JC8Z7K3M00000000000001${String(i).padStart(2, '0')}`,
      number: null,
      versions: [],
    })),
  };
}

function renderPage(service: (request: Request) => Promise<Response>) {
  const api = createApiClient({ baseUrl: 'http://localhost', fetch: service });
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queries}>
      <RollsPage api={api} />
    </QueryClientProvider>,
  );
}

function createRoll(roll: string) {
  fireEvent.change(screen.getByLabelText('Roll number'), {
    target: { value: roll },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create roll' }));
}

test('lists each roll with its number of frames', async () => {
  renderPage(fakeRollsService([aRoll('2025-003', 1), aRoll('2026-014', 36)]));

  expect(await screen.findByText('2025-003')).toBeDefined();
  expect(screen.getByText('1 frame')).toBeDefined();
  expect(screen.getByText('2026-014')).toBeDefined();
  expect(screen.getByText('36 frames')).toBeDefined();
});

test('says when there are no rolls yet', async () => {
  renderPage(fakeRollsService());

  expect(await screen.findByText('No rolls yet.')).toBeDefined();
});

test('says so when the rolls cannot be loaded', async () => {
  renderPage(() => Promise.resolve(new Response('', { status: 502 })));

  expect(
    await screen.findByText("Couldn't load the rolls. Is the service running?"),
  ).toBeDefined();
});

test('creates a roll and shows it in the list', async () => {
  renderPage(fakeRollsService());
  await screen.findByText('No rolls yet.');

  createRoll('2026-014');

  expect(await screen.findByText('2026-014')).toBeDefined();
  expect(screen.getByLabelText<HTMLInputElement>('Roll number').value).toBe('');
});

test('starts with an empty roll number field', async () => {
  renderPage(fakeRollsService([aRoll('2026-014')]));
  await screen.findByText('2026-014');

  expect(screen.getByLabelText<HTMLInputElement>('Roll number').value).toBe('');
});

test('explains why a roll number was refused', async () => {
  renderPage(fakeRollsService());
  await screen.findByText('No rolls yet.');

  createRoll('26-14');

  expect(
    await screen.findByText(
      'Enter a roll number like 2026-014: the year it was shot, then three digits.',
    ),
  ).toBeDefined();
});

test('says when the roll number is already taken', async () => {
  renderPage(fakeRollsService([aRoll('2026-014')]));
  await screen.findByText('2026-014');

  createRoll('2026-014');

  expect(
    await screen.findByText('Roll 2026-014 already exists.'),
  ).toBeDefined();
});
