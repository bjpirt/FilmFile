// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { App } from '../app.tsx';
import {
  aFrame,
  aRoll,
  fakeArchive,
  type FakeArchive,
} from '../testing/fake-archive.ts';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const roll = aRoll('2026-014', {
  event: 'iceland',
  shot: '2026-09-14',
  // In scan order; frame order is 1, 2, 3.
  frames: [
    aFrame('2', '12340002.jpg'),
    aFrame('1', '12340001.jpg'),
    aFrame('3', '12340003.jpg'),
  ],
});
const earlier = aRoll('2026-012', {
  event: 'iceland',
  shot: '2026-09-12',
  frames: [aFrame('36', '56780036.jpg')],
});

function frameId(number: string): string {
  const frame = [...roll.frames, ...earlier.frames].find(
    (f) => f.number === number,
  );
  return frame?.id ?? '';
}

function openAt(path: string, archive?: FakeArchive) {
  window.history.pushState(null, '', path);
  const service =
    archive ??
    fakeArchive({
      rolls: [roll, earlier],
      events: [{ slug: 'iceland', name: 'Iceland', date: '2026-09' }],
    });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <App api={service.api} />
    </QueryClientProvider>,
  );
}

/** The filmstrip's frames, each by its label, with the current one marked. */
function filmstrip(): string[] {
  return within(screen.getByRole('list', { name: 'Filmstrip' }))
    .getAllByRole('link')
    .map(
      (link) =>
        `${link.getAttribute('aria-label') ?? ''}${link.getAttribute('aria-current') === 'true' ? ' (shown)' : ''}`,
    );
}

describe('opened from a roll', () => {
  test('opens from the roll page by clicking a frame', async () => {
    openAt(`/rolls/${roll.id}`);

    fireEvent.click(await screen.findByRole('link', { name: 'Open frame 2' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Frame 2' }),
    ).toBeDefined();
    expect(window.location.pathname).toBe(
      `/rolls/${roll.id}/frames/${frameId('2')}`,
    );
  });

  test('shows the frame large, with a filmstrip of the roll’s frames in frame order', async () => {
    openAt(`/rolls/${roll.id}/frames/${frameId('2')}`);

    const image = await screen.findByRole('img', { name: '12340002.jpg' });
    expect(image.getAttribute('src')).toContain('size=large');
    expect(screen.getByText('2026-014')).toBeDefined();
    expect(filmstrip()).toEqual(['Frame 1', 'Frame 2 (shown)', 'Frame 3']);
  });

  test('steps to the next and previous frame with the arrows and keys, stopping at the ends', async () => {
    openAt(`/rolls/${roll.id}/frames/${frameId('1')}`);
    await screen.findByRole('heading', { name: 'Frame 1' });
    expect(
      screen
        .getByRole('button', { name: 'Previous frame' })
        .hasAttribute('disabled'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Next frame' }));
    expect(
      await screen.findByRole('heading', { name: 'Frame 2' }),
    ).toBeDefined();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(
      await screen.findByRole('heading', { name: 'Frame 3' }),
    ).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: 'Next frame' })
        .hasAttribute('disabled'),
    ).toBe(true);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(
      await screen.findByRole('heading', { name: 'Frame 2' }),
    ).toBeDefined();
  });

  test('goes straight to a frame clicked in the filmstrip', async () => {
    openAt(`/rolls/${roll.id}/frames/${frameId('1')}`);
    await screen.findByRole('heading', { name: 'Frame 1' });

    fireEvent.click(
      within(screen.getByRole('list', { name: 'Filmstrip' })).getByRole(
        'link',
        { name: 'Frame 3' },
      ),
    );

    expect(
      await screen.findByRole('heading', { name: 'Frame 3' }),
    ).toBeDefined();
  });

  test('goes back to the roll on Esc', async () => {
    openAt(`/rolls/${roll.id}/frames/${frameId('1')}`);
    await screen.findByRole('heading', { name: 'Frame 1' });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(
      await screen.findByRole('heading', { name: 'Roll 2026-014' }),
    ).toBeDefined();
  });

  test('says when the roll has no such frame', async () => {
    openAt(`/rolls/${roll.id}/frames/01JC8Z7K3M0000000000000000`);

    expect(await screen.findByText(/There is no such frame/)).toBeDefined();
  });
});

describe('opened from an event', () => {
  test('steps through the event’s frames from every roll, in the event page’s order', async () => {
    openAt(`/events/iceland/frames/${frameId('36')}?group=roll`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Frame 36' }),
    ).toBeDefined();
    expect(filmstrip()).toEqual([
      'Frame 36 of roll 2026-012 (shown)',
      'Frame 1 of roll 2026-014',
      'Frame 2 of roll 2026-014',
      'Frame 3 of roll 2026-014',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Next frame' }));
    expect(
      await screen.findByRole('heading', { name: 'Frame 1' }),
    ).toBeDefined();
    expect(window.location.search).toBe('?group=roll');
  });

  test('goes back to the event, as it was grouped, on Esc', async () => {
    openAt(`/events/iceland/frames/${frameId('36')}?group=roll`);
    await screen.findByRole('heading', { name: 'Frame 36' });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Iceland' }),
    ).toBeDefined();
    expect(window.location.search).toBe('?group=roll');
  });

  test('opens from the event page by clicking a frame', async () => {
    openAt('/events/iceland');

    fireEvent.click(
      await screen.findByRole('link', {
        name: 'Open frame 1 of roll 2026-014',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Frame 1' }),
    ).toBeDefined();
  });
});

describe('the frame’s details and versions', () => {
  const second = {
    id: '01JC8Z7K3M00000000000V0009',
    file: 'frames/x/z/12340001-again.jpg',
    sha256: 'again',
    bytes: 2_400_000,
    width: 3089,
    height: 2048,
    added: '2026-11-03T09:00:00.000Z',
  };
  const twice = aRoll('2026-020', {
    camera: 'nikon-fe',
    shot: '2026-09',
    frames: [
      {
        ...aFrame('1', '12340001.jpg'),
        versions: [...aFrame('1', '12340001.jpg').versions, second],
      },
    ],
  });

  async function showDetails() {
    fireEvent.click(
      await screen.findByRole('button', { name: 'Show details' }),
    );
  }

  function openTwice(): FakeArchive {
    const archive = fakeArchive({
      rolls: [twice],
      cameras: [{ slug: 'nikon-fe', make: 'Nikon', model: 'FE' }],
    });
    openAt(`/rolls/${twice.id}/frames/${twice.frames[0]?.id ?? ''}`, archive);
    return archive;
  }

  test('hides the details until the "i" shows them, remembering the choice', async () => {
    openTwice();
    const toggle = await screen.findByRole('button', { name: 'Show details' });
    expect(
      screen.queryByRole('complementary', { name: 'About this frame' }),
    ).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);

    expect(
      screen.getByRole('complementary', { name: 'About this frame' }),
    ).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: 'Hide details' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    cleanup();
    openTwice();
    expect(
      await screen.findByRole('complementary', { name: 'About this frame' }),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Hide details' }));

    expect(
      screen.queryByRole('complementary', { name: 'About this frame' }),
    ).toBeNull();
  });

  test('shows the roll’s details beside the frame', async () => {
    openTwice();
    await showDetails();

    const details = await screen.findByRole('complementary', {
      name: 'About this frame',
    });
    expect(await within(details).findByText('Nikon FE')).toBeDefined();
    expect(within(details).getByText('Sep 2026')).toBeDefined();
  });

  test('lists the frame’s versions, newest shown, each with its size and when it was added', async () => {
    openTwice();
    await showDetails();

    const versions = await screen.findByRole('list', { name: 'Versions' });
    expect(
      within(versions)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '12340001.jpg3 bytes · 3 × 2 · 2 Nov 2026Set as default',
      '12340001-again.jpg2.4 MB · 3089 × 2048 · 3 Nov 2026Shown',
    ]);
    expect(
      screen.getByRole('img', { name: '12340001-again.jpg' }),
    ).toBeDefined();
  });

  test('shows another version when it’s set as default, sending the roll’s ETag', async () => {
    const archive = openTwice();
    await showDetails();
    const versions = await screen.findByRole('list', { name: 'Versions' });

    fireEvent.click(
      within(versions).getByRole('button', { name: 'Set as default' }),
    );

    expect(
      await screen.findByRole('img', { name: '12340001.jpg' }),
    ).toBeDefined();
    expect(archive.ifMatches).toEqual(['"v1"']);
    expect(archive.rolls[0]?.frames[0]?.defaultVersion).toBe(
      aFrame('1', '12340001.jpg').versions[0]?.id,
    );
  });
});
