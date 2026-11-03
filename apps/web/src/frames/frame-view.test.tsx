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

afterEach(cleanup);

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
