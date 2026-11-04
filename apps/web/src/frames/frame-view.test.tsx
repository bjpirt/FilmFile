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
import type { Version } from '@filmfile/contracts/rolls';
import { App } from '../app.tsx';
import {
  aFrame,
  aRoll,
  fakeArchive,
  setUpArchive,
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
    // The roll is named only in the way back.
    expect(screen.getByRole('link', { name: 'Roll 2026-014' })).toBeDefined();
    expect(screen.queryByText('2026-014')).toBeNull();
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
  const second: Version = {
    id: '01JC8Z7K3M00000000000V0009',
    file: 'frames/x/z/12340001-again.jpg',
    sha256: 'again',
    bytes: 2_400_000,
    width: 3089,
    height: 2048,
    added: '2026-11-03T09:00:00.000Z',
    rotate: 0,
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

  test('shows who it’s by and its copyright, inherited from the archive', async () => {
    const archive = fakeArchive({
      rolls: [twice],
      cameras: [{ slug: 'nikon-fe', make: 'Nikon', model: 'FE' }],
      settings: {
        ...setUpArchive,
        author: 'Ben Pirt',
        copyright: '© Ben Pirt. All rights reserved.',
      },
    });
    openAt(`/rolls/${twice.id}/frames/${twice.frames[0]?.id ?? ''}`, archive);
    await showDetails();

    const details = await screen.findByRole('complementary', {
      name: 'About this frame',
    });
    expect(await within(details).findByText('Ben Pirt')).toBeDefined();
    expect(
      within(details).getByText('© Ben Pirt. All rights reserved.'),
    ).toBeDefined();
    expect(within(details).getByText('Nikon FE')).toBeDefined();
  });

  test('shows a frame’s versions in a column, the first in view and shown everywhere', async () => {
    openTwice();

    const column = await screen.findByRole('group', { name: 'Versions' });
    const versions = within(column).getAllByRole('button', { name: /^Show / });
    expect(versions.map((v) => v.getAttribute('aria-label'))).toEqual([
      'Show 12340001.jpg',
      'Show 12340001-again.jpg',
    ]);
    expect(versions.map((v) => v.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
    ]);
    expect(within(column).getByText('Shown everywhere')).toBeDefined();
    // The column has the "+", so the bar doesn't.
    expect(
      within(column).getByRole('button', { name: 'Add a version' }),
    ).toBeDefined();
    expect(
      screen.getAllByRole('button', { name: 'Add a version' }),
    ).toHaveLength(1);
    // The list in the details panel goes.
    await showDetails();
    expect(screen.queryByRole('list', { name: 'Versions' })).toBeNull();
  });

  test('shows another version in the frame view only, for a closer look', async () => {
    const archive = openTwice();
    const column = await screen.findByRole('group', { name: 'Versions' });

    fireEvent.click(
      within(column).getByRole('button', { name: 'Show 12340001-again.jpg' }),
    );

    expect(
      screen
        .getByRole('img', { name: '12340001-again.jpg' })
        .getAttribute('src'),
    ).toContain('size=large');
    expect(
      within(column)
        .getByRole('button', { name: 'Show 12340001-again.jpg' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    // Nothing is saved; the filmstrip still shows the first.
    expect(archive.ifMatches).toEqual([]);
    expect(
      within(screen.getByRole('list', { name: 'Filmstrip' }))
        .getAllByRole('presentation')
        .map((img) => img.getAttribute('src'))
        .join(),
    ).toContain(twice.frames[0]?.versions[0]?.id ?? 'missing');
  });

  test('has no column for a frame with one version, only the bar’s “+”', async () => {
    openAt(`/rolls/${roll.id}/frames/${frameId('1')}`);

    await screen.findByRole('heading', { level: 1, name: 'Frame 1' });
    expect(screen.queryByRole('group', { name: 'Versions' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a version' })).toBeDefined();
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

describe('deleting the frame', () => {
  /** A fresh archive, since deleting changes its rolls. */
  function archiveOf(): FakeArchive {
    return fakeArchive({
      rolls: [structuredClone(roll), structuredClone(earlier)],
      events: [{ slug: 'iceland', name: 'Iceland', date: '2026-09' }],
    });
  }

  async function deleteShown(number: string) {
    await screen.findByRole('heading', { level: 1, name: `Frame ${number}` });
    fireEvent.click(screen.getByRole('button', { name: 'Delete frame' }));
    fireEvent.click(
      within(
        screen.getByRole('alertdialog', { name: `Delete frame ${number}` }),
      ).getByRole('button', { name: 'Delete' }),
    );
  }

  test('asks first, then deletes it and moves on to the next frame', async () => {
    const archive = archiveOf();
    openAt(`/rolls/${roll.id}/frames/${frameId('2')}`, archive);

    await deleteShown('2');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Frame 3' }),
    ).toBeDefined();
    await vi.waitFor(() => {
      expect(filmstrip()).toEqual(['Frame 1', 'Frame 3 (shown)']);
    });
    expect(archive.deleted.map((f) => f.number)).toEqual(['2']);
    expect(archive.ifMatches).toEqual(['"v1"']);
  });

  test('moves back to the previous frame when it was the last', async () => {
    openAt(`/rolls/${roll.id}/frames/${frameId('3')}`, archiveOf());

    await deleteShown('3');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Frame 2' }),
    ).toBeDefined();
  });

  test('goes back to the roll when no frame is left', async () => {
    openAt(`/rolls/${earlier.id}/frames/${frameId('36')}`, archiveOf());

    await deleteShown('36');

    expect(
      await screen.findByRole('heading', { name: 'Roll 2026-012' }),
    ).toBeDefined();
  });

  test('keeps it when cancelled, with Cancel or Esc', async () => {
    const archive = archiveOf();
    openAt(`/rolls/${roll.id}/frames/${frameId('2')}`, archive);
    await screen.findByRole('heading', { level: 1, name: 'Frame 2' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete frame' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete frame' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Frame 2' }),
    ).toBeDefined();
    expect(archive.deleted).toEqual([]);
  });

  test('moves on through the event’s frames when opened from an event', async () => {
    const archive = archiveOf();
    openAt(`/events/iceland/frames/${frameId('36')}?group=roll`, archive);

    await deleteShown('36');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Frame 1' }),
    ).toBeDefined();
    expect(window.location.search).toBe('?group=roll');
    await vi.waitFor(() => {
      expect(filmstrip()).toEqual([
        'Frame 1 of roll 2026-014 (shown)',
        'Frame 2 of roll 2026-014',
        'Frame 3 of roll 2026-014',
      ]);
    });
  });

  test('says when the roll changed elsewhere, keeping the frame', async () => {
    const archive = archiveOf();
    openAt(`/rolls/${roll.id}/frames/${frameId('2')}`, archive);
    await screen.findByRole('heading', { level: 1, name: 'Frame 2' });
    archive.changeRoll(roll.id);

    await deleteShown('2');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This roll changed since you opened it. Reload the page.',
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Frame 2' }),
    ).toBeDefined();
    expect(archive.deleted).toEqual([]);
  });
});

describe('turning the frame', () => {
  function openFirst(): FakeArchive {
    const archive = fakeArchive({ rolls: [structuredClone(roll)] });
    openAt(`/rolls/${roll.id}/frames/${frameId('1')}`, archive);
    return archive;
  }

  function shownImage(): HTMLElement {
    return screen.getByRole('img', { name: '12340001.jpg' });
  }

  function savedTurn(archive: FakeArchive) {
    return archive.rolls[0]?.frames.find((f) => f.number === '1')?.versions[0]
      ?.rotate;
  }

  test('turns the version shown a quarter turn clockwise, keeping it', async () => {
    const archive = openFirst();
    await screen.findByRole('heading', { level: 1, name: 'Frame 1' });

    fireEvent.click(screen.getByRole('button', { name: 'Rotate clockwise' }));

    await vi.waitFor(() => {
      expect(shownImage().getAttribute('src')).toContain('rotate=90');
    });
    expect(savedTurn(archive)).toBe(90);
    expect(archive.ifMatches).toEqual(['"v1"']);
    // A turned scan's shape is turned too: 3 × 2 becomes 2 × 3.
    expect(shownImage().getAttribute('width')).toBe('2');
    expect(shownImage().getAttribute('height')).toBe('3');
  });

  test('turns anticlockwise, round past upright', async () => {
    const archive = openFirst();
    await screen.findByRole('heading', { level: 1, name: 'Frame 1' });

    fireEvent.click(
      screen.getByRole('button', { name: 'Rotate anticlockwise' }),
    );

    await vi.waitFor(() => {
      expect(savedTurn(archive)).toBe(270);
    });
    expect(shownImage().getAttribute('src')).toContain('rotate=270');
  });

  test('shows it turned in the filmstrip too', async () => {
    openFirst();
    await screen.findByRole('heading', { level: 1, name: 'Frame 1' });

    fireEvent.click(screen.getByRole('button', { name: 'Rotate clockwise' }));

    await vi.waitFor(() => {
      expect(
        within(screen.getByRole('link', { name: 'Frame 1' }))
          .getByRole('presentation')
          .getAttribute('src'),
      ).toContain('rotate=90');
    });
  });

  test('leaves an upright version’s address as it was', async () => {
    openFirst();

    expect(
      (await screen.findByRole('img', { name: '12340001.jpg' })).getAttribute(
        'src',
      ),
    ).not.toContain('rotate');
  });
});

describe('a frame’s own details, and those it inherits', () => {
  const leica = { slug: 'leica-m6', make: 'Leica', model: 'M6' };
  const nikon = { slug: 'nikon-fe', make: 'Nikon', model: 'FE' };

  function openWith(frameCamera: string | null): FakeArchive {
    const roll = aRoll('2026-030', {
      camera: 'nikon-fe',
      frames: [
        { ...aFrame('1', '12340001.jpg'), camera: frameCamera },
        aFrame('2', '12340002.jpg'),
      ],
    });
    const archive = fakeArchive({
      rolls: [roll],
      cameras: [nikon, leica],
      settings: { ...setUpArchive, author: 'Ben Pirt' },
    });
    openAt(`/rolls/${roll.id}/frames/${roll.frames[0]?.id ?? ''}`, archive);
    return archive;
  }

  async function detail(label: string): Promise<HTMLElement> {
    const show = await screen.findByRole('button', {
      name: /^(Show|Hide) details$/,
    });
    if (show.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(show);
    }
    const details = await screen.findByRole('complementary', {
      name: 'About this frame',
    });
    await within(details).findByText('Ben Pirt');
    const term = within(details).getByText(label, { selector: 'dt' });
    const value = term.nextElementSibling;
    if (!(value instanceof HTMLElement)) {
      throw new Error(`no value for ${label}`);
    }
    return value;
  }

  test('shows inherited details as they are, saying nothing of where they came from', async () => {
    openWith(null);

    expect((await detail('Camera')).textContent).toBe('Nikon FE');
    expect((await detail('Author')).textContent).toBe('Ben Pirt');
    expect(screen.queryByText(/^from the/)).toBeNull();
  });

  test('marks the frame’s own with a reset that goes back to the roll’s', async () => {
    const archive = openWith('leica-m6');
    const camera = await detail('Camera');
    expect(camera.textContent).toBe('Leica M6');
    expect(
      screen.queryByRole('button', { name: /on the roll instead/ }),
    ).toBeNull();

    fireEvent.click(
      within(camera).getByRole('button', { name: 'Use the roll’s camera' }),
    );

    await vi.waitFor(() => {
      expect(archive.rolls[0]?.frames[0]?.camera).toBeNull();
    });
    expect(await screen.findByText('Nikon FE')).toBeDefined();
  });
});

describe('editing a frame’s details in place', () => {
  const leica = { slug: 'leica-m6', make: 'Leica', model: 'M6' };
  const nikon = { slug: 'nikon-fe', make: 'Nikon', model: 'FE' };

  function openWith(
    frameCamera: string | null,
    rollCamera: string | null = 'nikon-fe',
  ): FakeArchive {
    const roll = aRoll('2026-031', {
      camera: rollCamera,
      event: 'iceland',
      frames: [{ ...aFrame('1', '12340001.jpg'), camera: frameCamera }],
    });
    const archive = fakeArchive({
      rolls: [roll],
      cameras: [nikon, leica],
      events: [
        { slug: 'iceland', name: 'Iceland', date: null },
        { slug: 'westfjords', name: 'Westfjords', date: null },
      ],
    });
    openAt(`/rolls/${roll.id}/frames/${roll.frames[0]?.id ?? ''}`, archive);
    return archive;
  }

  /** The details panel, once it shows the camera as given. */
  async function panel(camera = 'Nikon FE'): Promise<HTMLElement> {
    const show = await screen.findByRole('button', {
      name: /^(Show|Hide) details$/,
    });
    if (show.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(show);
    }
    const details = await screen.findByRole('complementary', {
      name: 'About this frame',
    });
    await within(details).findAllByText(camera);
    return details;
  }

  test('changes the camera to one of the archive’s, as the frame’s own', async () => {
    const archive = openWith(null);
    const details = await panel();

    fireEvent.click(
      within(details).getByRole('button', { name: 'Change the camera' }),
    );
    const choice = within(details).getByRole('combobox', { name: 'Camera' });
    expect(
      within(choice)
        .getAllByRole('option')
        .map((option) => option.textContent),
      // The roll's first, then the archive's, as it lists them.
    ).toEqual(['The roll’s: Nikon FE', 'Nikon FE', 'Leica M6']);
    fireEvent.change(choice, { target: { value: 'leica-m6' } });

    await vi.waitFor(() => {
      expect(archive.rolls[0]?.frames[0]?.camera).toBe('leica-m6');
    });
    expect(await within(details).findByText('Leica M6')).toBeDefined();
    expect(within(details).queryByRole('combobox')).toBeNull();
    expect(
      within(details).getByRole('button', { name: 'Use the roll’s camera' }),
    ).toBeDefined();
  });

  test('goes back to the roll’s by choosing it', async () => {
    const archive = openWith('leica-m6');
    const details = await panel('Leica M6');

    fireEvent.click(
      within(details).getByRole('button', { name: 'Change the camera' }),
    );
    fireEvent.change(
      within(details).getByRole('combobox', { name: 'Camera' }),
      {
        target: { value: '' },
      },
    );

    await vi.waitFor(() => {
      expect(archive.rolls[0]?.frames[0]?.camera).toBeNull();
    });
  });

  test('puts the frame in another event', async () => {
    const archive = openWith(null);
    const details = await panel();

    fireEvent.click(
      within(details).getByRole('button', { name: 'Change the event' }),
    );
    fireEvent.change(within(details).getByRole('combobox', { name: 'Event' }), {
      target: { value: 'westfjords' },
    });

    await vi.waitFor(() => {
      expect(archive.rolls[0]?.frames[0]?.events).toEqual(['westfjords']);
    });
  });

  test('leaves it as it was on Esc, still in the frame view', async () => {
    const archive = openWith(null);
    const details = await panel();
    fireEvent.click(
      within(details).getByRole('button', { name: 'Change the camera' }),
    );

    fireEvent.keyDown(
      within(details).getByRole('combobox', { name: 'Camera' }),
      {
        key: 'Escape',
      },
    );

    expect(within(details).queryByRole('combobox')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Frame 1' }),
    ).toBeDefined();
    expect(archive.ifMatches).toEqual([]);
  });

  test('offers a camera to set when neither the roll nor the frame has one', async () => {
    openWith(null, null);
    const details = await panel('Not set');

    const change = await within(details).findByRole('button', {
      name: 'Change the camera',
    });
    expect(change.textContent).toBe('Not set');
  });

  test('changes only the camera, lens and event here', async () => {
    openWith(null);
    const details = await panel();

    expect(
      within(details)
        .getAllByRole('button', { name: /^Change the/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Change the camera', 'Change the lens', 'Change the event']);
  });
});

describe('a frame’s own date shot', () => {
  function openDated(frameShot: string | null): FakeArchive {
    const roll = aRoll('2026-032', {
      shot: '2026-09-14',
      frames: [{ ...aFrame('1', '12340001.jpg'), shot: frameShot }],
    });
    const archive = fakeArchive({ rolls: [roll] });
    openAt(`/rolls/${roll.id}/frames/${roll.frames[0]?.id ?? ''}`, archive);
    return archive;
  }

  async function panel(date: string): Promise<HTMLElement> {
    const show = await screen.findByRole('button', {
      name: /^(Show|Hide) details$/,
    });
    if (show.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(show);
    }
    const details = await screen.findByRole('complementary', {
      name: 'About this frame',
    });
    await within(details).findByText(date);
    return details;
  }

  test('gives the frame its own date and time, saved on Enter', async () => {
    const archive = openDated(null);
    const details = await panel('14 Sep 2026');

    fireEvent.click(
      within(details).getByRole('button', { name: 'Change the date shot' }),
    );
    const fields = within(details).getByRole('group', { name: 'Date shot' });
    fireEvent.change(within(fields).getByLabelText('Day'), {
      target: { value: '15' },
    });
    fireEvent.change(within(fields).getByLabelText('Time'), {
      target: { value: '06:30' },
    });
    fireEvent.submit(fields);

    await vi.waitFor(() => {
      expect(archive.rolls[0]?.frames[0]?.shot).toBe('2026-09-15T06:30');
    });
    expect(
      await within(details).findByText('15 Sep 2026, 06:30'),
    ).toBeDefined();
    expect(
      within(details).getByRole('button', { name: 'Use the roll’s date shot' }),
    ).toBeDefined();
  });

  test('keeps the date as it was on Esc, still in the frame view', async () => {
    const archive = openDated(null);
    const details = await panel('14 Sep 2026');
    fireEvent.click(
      within(details).getByRole('button', { name: 'Change the date shot' }),
    );

    fireEvent.keyDown(within(details).getByLabelText('Day'), {
      key: 'Escape',
    });

    expect(
      within(details).queryByRole('group', { name: 'Date shot' }),
    ).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Frame 1' }),
    ).toBeDefined();
    expect(archive.ifMatches).toEqual([]);
  });

  test('goes back to the roll’s date', async () => {
    const archive = openDated('2026-09-15');
    const details = await panel('15 Sep 2026');

    fireEvent.click(
      within(details).getByRole('button', { name: 'Use the roll’s date shot' }),
    );

    await vi.waitFor(() => {
      expect(archive.rolls[0]?.frames[0]?.shot).toBeNull();
    });
    expect(await within(details).findByText('14 Sep 2026')).toBeDefined();
  });
});

describe('adding a version', () => {
  function openOne(): FakeArchive {
    const archive = fakeArchive({ rolls: [structuredClone(roll)] });
    openAt(`/rolls/${roll.id}/frames/${frameId('1')}`, archive);
    return archive;
  }

  function choose(file: File) {
    fireEvent.change(screen.getByLabelText('Image to add as a version'), {
      target: { files: [file] },
    });
  }

  test('adds an image to the frame as another version, keeping the first shown', async () => {
    const archive = openOne();
    await screen.findByRole('heading', { level: 1, name: 'Frame 1' });
    expect(screen.getByRole('button', { name: 'Add a version' })).toBeDefined();

    choose(new File(['edited'], 'edit.png', { type: 'image/png' }));

    await vi.waitFor(() => {
      expect(
        archive.rolls[0]?.frames.find((f) => f.number === '1')?.versions,
      ).toHaveLength(2);
    });
    expect(archive.uploads).toEqual(['edit.png']);
    expect(screen.getByRole('img', { name: '12340001.jpg' })).toBeDefined();
  });

  test('refuses an image that isn’t a JPEG, PNG or WebP, sending nothing', async () => {
    const archive = openOne();
    await screen.findByRole('heading', { level: 1, name: 'Frame 1' });

    choose(new File(['gif'], 'scan.gif', { type: 'image/gif' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Only JPEG, PNG and WebP images can be added.',
    );
    expect(archive.uploads).toEqual([]);
  });

  test('says when the image is already in the roll', async () => {
    openOne();
    await screen.findByRole('heading', { level: 1, name: 'Frame 1' });

    const edit = () => new File(['edited'], 'edit.png', { type: 'image/png' });
    // Added one after the other, the second is the same image again.
    choose(edit());
    choose(edit());

    expect((await screen.findByRole('alert')).textContent).toBe(
      'That image is already in this roll.',
    );
  });
});
