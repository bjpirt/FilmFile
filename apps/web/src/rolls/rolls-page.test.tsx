// @vitest-environment happy-dom
import { createApiClient } from '@filmfile/contracts/client';
import type { Roll, UnreadableRoll } from '@filmfile/contracts/rolls';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { RollsPage } from './rolls-page.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

/** Answers the rolls endpoints the way the backend does, keeping rolls in memory. */
function fakeRollsService(
  rolls: Roll[] = [],
  unreadable: UnreadableRoll[] = [],
) {
  let nextId = 0;
  return async (request: Request): Promise<Response> => {
    if (request.method === 'GET') {
      return Response.json({ rolls, unreadable });
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
    // Unique per roll number, e.g. 2026-014 → 01JC8Z7K3M0000000002026014.
    id: `01JC8Z7K3M000000000${roll.replace('-', '')}`,
    roll,
    frames: Array.from({ length: frames }, (_, i) => ({
      id: `01JC8Z7K3M00000000000001${String(i).padStart(2, '0')}`,
      number: null,
      versions: [],
    })),
  };
}

function renderPage(
  service: (request: Request) => Promise<Response>,
  { browseOpen = true }: { browseOpen?: boolean } = {},
) {
  const api = createApiClient({ baseUrl: 'http://localhost', fetch: service });
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queries}>
      <RollsPage api={api} browseOpen={browseOpen} />
    </QueryClientProvider>,
  );
}

/** A roll whose frames each have a scan, so its card shows thumbnails. */
function aRollWithScans(roll: string, scans: number): Roll {
  return {
    ...aRoll(roll),
    frames: Array.from({ length: scans }, (_, i) => {
      const n = String(i).padStart(2, '0');
      return {
        id: `01JC8Z7K3M00000000000001${n}`,
        number: String(i + 1),
        versions: [
          {
            id: `01JC8Z7K3M00000000000002${n}`,
            file: `frames/x/y/123400${n}.jpg`,
            sha256: n.padStart(64, '0'),
            bytes: 3,
            width: 3,
            height: 2,
            added: '2026-11-02T12:00:00.000Z',
          },
        ],
      };
    }),
  };
}

function openNewRoll() {
  fireEvent.click(screen.getByRole('button', { name: 'New roll' }));
}

function createRoll(roll: string) {
  openNewRoll();
  fireEvent.change(screen.getByLabelText('Roll number'), {
    target: { value: roll },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create roll' }));
}

test('shows each roll as a card with its first three scans', async () => {
  renderPage(fakeRollsService([aRollWithScans('2026-014', 5)]));

  const card = (await screen.findByText('2026-014')).closest('li');
  const peek = Array.from(card?.querySelectorAll('img') ?? [], (img) =>
    img.getAttribute('src'),
  );

  expect(peek).toEqual(
    ['00', '01', '02'].map(
      (n) =>
        `/api/rolls/01JC8Z7K3M0000000002026014/frames/01JC8Z7K3M00000000000001${n}/versions/01JC8Z7K3M00000000000002${n}/thumbnail?size=small`,
    ),
  );
  expect(screen.getByText('5 frames')).toBeDefined();
});

describe('grouping, browsing and the address', () => {
  const someRolls = () =>
    fakeRollsService([
      aRoll('2025-003', 1),
      aRoll('2026-001', 2),
      aRoll('2026-014', 3),
    ]);

  /** The rolls shown, by roll number, in order. */
  function rollsShown(): string[] {
    return screen
      .getAllByRole('link')
      .map((link) => link.textContent)
      .filter((text) => /^\d{4}-\d{3}$/.test(text));
  }

  test('groups rolls by year, newest first, with a count for each', async () => {
    renderPage(someRolls());
    await screen.findByText('2026-014');

    fireEvent.change(screen.getByLabelText('Group by'), {
      target: { value: 'year' },
    });

    const groupHeadings = screen
      .getAllByRole('heading', { level: 2 })
      .filter((heading) => heading.closest('aside') === null);
    expect(groupHeadings.map((h) => h.textContent)).toEqual([
      '2026 2 rolls',
      '2025 1 roll',
    ]);
    expect(window.location.search).toBe('?view=grid&group=year');
  });

  test('lists the years in the browse panel, and filters by the one chosen', async () => {
    renderPage(someRolls());
    const browse = await screen.findByRole('complementary', {
      name: 'Browse rolls',
    });

    fireEvent.click(within(browse).getByRole('button', { name: /^2025/ }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Rolls from 2025' }),
    ).toBeDefined();
    expect(rollsShown()).toEqual(['2025-003']);
    expect(window.location.search).toBe('?view=grid&year=2025');
    expect(
      within(browse)
        .getByRole('button', { name: /^2025/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  test('shows every roll again from All rolls', async () => {
    window.history.replaceState(null, '', '/?year=2025');
    renderPage(someRolls());
    await screen.findByText('2025-003');

    fireEvent.click(screen.getByRole('button', { name: /^All rolls/ }));

    expect(rollsShown()).toEqual(['2025-003', '2026-001', '2026-014']);
    expect(window.location.search).toBe('?view=grid');
  });

  test('opens with the view, grouping and filter in the address', async () => {
    window.history.replaceState(null, '', '/?view=list&group=year&year=2026');

    renderPage(someRolls());

    expect(await screen.findByRole('table')).toBeDefined();
    expect(rollsShown()).toEqual(['2026-001', '2026-014']);
    expect(screen.getByLabelText<HTMLSelectElement>('Group by').value).toBe(
      'year',
    );
  });

  test('counts the rolls in each year in the browse panel', async () => {
    renderPage(someRolls());
    const browse = await screen.findByRole('complementary', {
      name: 'Browse rolls',
    });

    expect(
      within(browse)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['All rolls3', '20262', '20251']);
  });

  test('leaves out the browse panel when it is closed', async () => {
    renderPage(someRolls(), { browseOpen: false });
    await screen.findByText('2026-014');

    expect(screen.queryByRole('complementary')).toBeNull();
  });
});

describe('the list view', () => {
  function showList() {
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
  }

  test('shows the rolls as a table: roll, a strip of scans and frames', async () => {
    renderPage(
      fakeRollsService([aRollWithScans('2026-014', 5), aRoll('2026-015')]),
    );
    await screen.findByText('2026-014');

    showList();

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      '2026-0145',
      '2026-015—',
    ]);
    expect(rows[0]?.querySelectorAll('img')).toHaveLength(4);
    expect(
      screen.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual(['Roll', 'Strip', 'Frames']);
  });

  test('marks which view is showing', async () => {
    renderPage(fakeRollsService([aRoll('2026-014')]));
    await screen.findByText('2026-014');

    expect(
      screen.getByRole('button', { name: 'Grid' }).getAttribute('aria-pressed'),
    ).toBe('true');

    showList();

    expect(
      screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Grid' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  test('is remembered for next time', async () => {
    renderPage(fakeRollsService([aRoll('2026-014')]));
    await screen.findByText('2026-014');
    showList();
    cleanup();

    renderPage(fakeRollsService([aRoll('2026-014')]));

    expect(await screen.findByRole('table')).toBeDefined();
  });
});

test('says when a roll has no frames yet', async () => {
  renderPage(fakeRollsService([aRoll('2026-014')]));

  expect(await screen.findByText('No frames yet')).toBeDefined();
});

test('lists each roll with its number of frames', async () => {
  renderPage(fakeRollsService([aRoll('2025-003', 1), aRoll('2026-014', 36)]));

  expect(await screen.findByText('2025-003')).toBeDefined();
  expect(screen.getByText('1 frame')).toBeDefined();
  expect(screen.getByText('2026-014')).toBeDefined();
  expect(screen.getByText('36 frames')).toBeDefined();
});

test('names any roll whose file cannot be read, and what is wrong', async () => {
  renderPage(
    fakeRollsService(
      [aRoll('2026-014')],
      [{ folder: '2026-015', problem: 'it is not valid JSON' }],
    ),
  );

  expect(
    await screen.findByText(
      "Roll 2026-015 can't be read: it is not valid JSON. Fix or replace its roll.json in the archive.",
    ),
  ).toBeDefined();
  expect(screen.getByText('2026-014')).toBeDefined();
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
  expect(screen.queryByLabelText('Roll number')).toBeNull();
});

test('asks for a roll number only after New roll, starting empty', async () => {
  renderPage(fakeRollsService([aRoll('2026-014')]));
  await screen.findByText('2026-014');
  expect(screen.queryByLabelText('Roll number')).toBeNull();

  openNewRoll();

  expect(screen.getByLabelText<HTMLInputElement>('Roll number').value).toBe('');
});

test('puts New roll away on Cancel', async () => {
  renderPage(fakeRollsService());
  await screen.findByText('No rolls yet.');
  openNewRoll();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.queryByLabelText('Roll number')).toBeNull();
  expect(screen.getByRole('button', { name: 'New roll' })).toBeDefined();
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
