// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
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

describe('describing a frame', () => {
  const first = roll.frames[1];

  function openFirst(): FakeArchive {
    const archive = fakeArchive({ rolls: [structuredClone(roll)] });
    openAt(`/rolls/${roll.id}/frames/${first?.id ?? ''}`, archive);
    return archive;
  }

  async function showDetails() {
    fireEvent.click(
      await screen.findByRole('button', { name: 'Show details' }),
    );
    return screen.findByRole('complementary', { name: 'About this frame' });
  }

  function savedFrame(archive: FakeArchive) {
    return archive.rolls[0]?.frames.find((f) => f.id === first?.id);
  }

  test('saves the title and notes on leaving each field, showing the title under the heading', async () => {
    const archive = openFirst();
    const details = await showDetails();

    const title = within(details).getByRole('textbox', { name: 'Title' });
    fireEvent.change(title, { target: { value: 'Mill pond' } });
    fireEvent.blur(title);
    expect(
      await screen.findByText('Mill pond', { selector: 'p' }),
    ).toBeDefined();
    const notes = within(details).getByRole('textbox', { name: 'Notes' });
    fireEvent.change(notes, { target: { value: 'Early fog' } });
    fireEvent.blur(notes);

    await vi.waitFor(() => {
      expect(savedFrame(archive)?.notes).toBe('Early fog');
    });
    expect(savedFrame(archive)?.title).toBe('Mill pond');
    // Each save is sent against the roll as the last one left it.
    expect(archive.ifMatches).toEqual(['"v1"', '"v2"']);
  });

  test('starts with the frame’s own notes, not its roll’s (D40)', async () => {
    const archive = fakeArchive({
      rolls: [{ ...structuredClone(roll), notes: 'Developed in HC-110.' }],
    });
    openAt(`/rolls/${roll.id}/frames/${first?.id ?? ''}`, archive);
    const details = await showDetails();

    expect(
      within(details).getByRole('textbox', { name: 'Notes' }),
    ).toHaveProperty('value', '');
    expect(within(details).queryByText('Developed in HC-110.')).toBeNull();
  });

  test('saves nothing when a field is left unchanged', async () => {
    const archive = openFirst();
    const details = await showDetails();

    fireEvent.blur(within(details).getByRole('textbox', { name: 'Title' }));

    expect(archive.ifMatches).toEqual([]);
  });

  test('rates the frame by clicking a star, and clears it by clicking it again', async () => {
    const archive = openFirst();
    const details = await showDetails();

    fireEvent.click(within(details).getByRole('button', { name: '4 stars' }));

    await vi.waitFor(() => {
      expect(
        within(details)
          .getByRole('button', { name: '4 stars' })
          .getAttribute('aria-pressed'),
      ).toBe('true');
    });
    expect(savedFrame(archive)?.rating).toBe(4);

    fireEvent.click(within(details).getByRole('button', { name: '4 stars' }));

    await vi.waitFor(() => {
      expect(savedFrame(archive)?.rating).toBeNull();
    });
  });

  test('rates the frame with the 1 to 5 keys, details shown or not, and clears it with 0', async () => {
    const archive = openFirst();
    await screen.findByRole('heading', { name: 'Frame 1' });

    fireEvent.keyDown(window, { key: '3' });

    expect(await screen.findByLabelText('Rated 3 of 5')).toBeDefined();
    expect(savedFrame(archive)?.rating).toBe(3);

    fireEvent.keyDown(window, { key: '0' });

    await vi.waitFor(() => {
      expect(screen.queryByLabelText(/^Rated/)).toBeNull();
    });
    expect(savedFrame(archive)?.rating).toBeNull();
  });

  test('ignores the number keys while typing in a field', async () => {
    const archive = openFirst();
    const details = await showDetails();

    fireEvent.keyDown(within(details).getByRole('textbox', { name: 'Title' }), {
      key: '3',
    });

    expect(archive.ifMatches).toEqual([]);
  });

  test('says when the roll changed elsewhere, keeping it as it is', async () => {
    const archive = openFirst();
    await screen.findByRole('heading', { name: 'Frame 1' });
    archive.changeRoll(roll.id);

    fireEvent.keyDown(window, { key: '5' });

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This roll changed since you opened it. Reload the page.',
    );
    expect(savedFrame(archive)?.rating).toBeNull();
  });
});
