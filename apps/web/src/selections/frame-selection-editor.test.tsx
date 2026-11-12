// @vitest-environment happy-dom
import type { FrameSelection } from '@filmfile/contracts/selections';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import {
  aFrame,
  aRoll,
  fakeArchive,
  type FakeArchive,
} from '../testing/fake-archive.ts';
import { FrameSelectionEditor } from './frame-selection-editor.tsx';
import { everyFrame, exclude } from './selection-edit.ts';

afterEach(cleanup);

function aTwoRollArchive(more: Parameters<typeof fakeArchive>[0] = {}) {
  return fakeArchive({
    rolls: [
      aRoll('2026-001', {
        name: 'Iceland',
        frames: [aFrame('1', '12340001.jpg'), aFrame('2', '12340002.jpg')],
      }),
      aRoll('2026-002', { frames: [aFrame('1', '12340003.jpg')] }),
    ],
    ...more,
  });
}

function Harness({
  archive,
  initial,
  withActions = false,
}: {
  readonly archive: FakeArchive;
  readonly initial: FrameSelection;
  readonly withActions?: boolean;
}) {
  const [selection, setSelection] = useState(initial);
  return (
    <FrameSelectionEditor
      api={archive.api}
      selection={selection}
      change={setSelection}
      {...(withActions
        ? {
            frameActions: (frame) => (
              <button
                type="button"
                onClick={() => {
                  setSelection(exclude(selection, frame));
                }}
              >
                Exclude {frame.frameId.slice(-4)}
              </button>
            ),
          }
        : {})}
    />
  );
}

function show(
  archive: FakeArchive,
  initial: FrameSelection = everyFrame,
  withActions = false,
) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Harness archive={archive} initial={initial} withActions={withActions} />
    </QueryClientProvider>,
  );
}

const lastSearch = (archive: FakeArchive) => archive.searches.at(-1);

function addRule(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Add a rule ▾' }));
  fireEvent.click(screen.getByRole('menuitem', { name }));
}

test('says how many frames match and shows each, opening it in its roll', async () => {
  show(aTwoRollArchive());

  expect(await screen.findByText('3 frames match')).toBeTruthy();
  const link = screen.getByRole('link', { name: 'Roll 2026-001, frame 2' });
  expect(link.getAttribute('href')).toBe(
    '/rolls/01JC8Z7K3M0000000002026001/frames/01JC8Z7K3M00000000000F0002',
  );
});

test('says "1 frame matches" and "No frames match"', async () => {
  show(
    fakeArchive({
      rolls: [aRoll('2026-001', { frames: [aFrame('1', '12340001.jpg')] })],
    }),
  );
  expect(await screen.findByText('1 frame matches')).toBeTruthy();
  cleanup();

  show(fakeArchive({ rolls: [aRoll('2026-001')] }));
  expect(await screen.findByText('No frames match')).toBeTruthy();
});

test('offers each kind of rule once, and not the ones already added', async () => {
  show(aTwoRollArchive());
  await screen.findByText('3 frames match');

  fireEvent.click(screen.getByRole('button', { name: 'Add a rule ▾' }));
  expect(
    screen.getAllByRole('menuitem').map((item) => item.textContent),
  ).toEqual([
    'Rated at least',
    'Event is',
    'Roll is',
    'Camera is',
    'Lens is',
    'Film stock is',
    'Shot on or after',
    'Shot on or before',
    'Has a Final',
    'Has a Raw scan',
  ]);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rated at least' }));

  fireEvent.click(screen.getByRole('button', { name: 'Add a rule ▾' }));
  expect(screen.queryByRole('menuitem', { name: 'Rated at least' })).toBeNull();
  expect(screen.getByRole('menuitem', { name: 'Event is' })).toBeTruthy();
});

test('searches again as a rule is added, changed and removed, without saving anything', async () => {
  const archive = aTwoRollArchive();
  show(archive);
  await screen.findByText('3 frames match');

  addRule('Rated at least');
  await waitFor(() => {
    expect(lastSearch(archive)).toMatchObject({
      rules: [{ kind: 'rating', atLeast: 4 }],
    });
  });

  fireEvent.change(screen.getByLabelText('Rated at least'), {
    target: { value: '2' },
  });
  await waitFor(() => {
    expect(lastSearch(archive)).toMatchObject({
      rules: [{ kind: 'rating', atLeast: 2 }],
    });
  });

  fireEvent.click(
    screen.getByRole('button', { name: 'Remove rule: Rated at least' }),
  );
  await waitFor(() => {
    expect(lastSearch(archive)).toMatchObject({ rules: [] });
  });
  expect(
    archive.requests
      .filter((r) => !r.startsWith('GET'))
      .every((r) => r.startsWith('POST /api/frames/search')),
  ).toBe(true);
});

test('chooses events from a list, any of them', async () => {
  const archive = aTwoRollArchive({
    events: [
      { slug: 'iceland', name: 'Iceland 2026', date: '2026-09' },
      { slug: 'norway', name: 'Norway', date: null },
    ],
  });
  show(archive);
  await screen.findByText('3 frames match');

  addRule('Event is');
  const events = await screen.findByRole('group', { name: 'Event is' });
  expect(within(events).getByText(/Choose at least one/)).toBeTruthy();
  fireEvent.click(await within(events).findByLabelText('Iceland 2026'));
  fireEvent.click(within(events).getByLabelText('Norway'));

  await waitFor(() => {
    expect(lastSearch(archive)).toMatchObject({
      rules: [{ kind: 'event', events: ['iceland', 'norway'] }],
    });
  });
  fireEvent.click(within(events).getByLabelText('Norway'));
  await waitFor(() => {
    expect(lastSearch(archive)).toMatchObject({
      rules: [{ kind: 'event', events: ['iceland'] }],
    });
  });
});

test('chooses rolls by number and name', async () => {
  const archive = aTwoRollArchive();
  show(archive);
  await screen.findByText('3 frames match');

  addRule('Roll is');
  const rolls = await screen.findByRole('group', { name: 'Roll is' });
  expect(await within(rolls).findByLabelText('2026-001 Iceland')).toBeTruthy();
  expect(within(rolls).getByLabelText('2026-002')).toBeTruthy();
});

test('shows an event that has since gone as no longer in the archive, to be unticked', async () => {
  const archive = aTwoRollArchive({
    events: [{ slug: 'iceland', name: 'Iceland 2026', date: null }],
  });
  show(archive, {
    ...everyFrame,
    rules: [{ kind: 'event', events: ['iceland', 'old-trip'] }],
  });

  const gone = await screen.findByLabelText<HTMLInputElement>(
    'old-trip (no longer in the archive)',
  );
  expect(gone.checked).toBe(true);
  fireEvent.click(gone);
  await waitFor(() => {
    expect(lastSearch(archive)).toMatchObject({
      rules: [{ kind: 'event', events: ['iceland'] }],
    });
  });
});

test('does not call a rule’s choice gone while the archive is still loading', async () => {
  show(
    aTwoRollArchive({
      events: [{ slug: 'iceland', name: 'Iceland', date: null }],
    }),
    {
      ...everyFrame,
      rules: [{ kind: 'event', events: ['iceland'] }],
    },
  );

  expect(screen.queryByText(/no longer in the archive/)).toBeNull();
  expect(await screen.findByLabelText('Iceland')).toBeTruthy();
  expect(screen.queryByText(/no longer in the archive/)).toBeNull();
});

test('waits for a real date before searching on it', async () => {
  const archive = aTwoRollArchive();
  show(archive);
  await screen.findByText('3 frames match');

  addRule('Shot on or after');
  const date = screen.getByLabelText('Shot on or after');
  expect(screen.getByText('Type a year, month or day.')).toBeTruthy();

  fireEvent.change(date, { target: { value: '2026-1' } });
  expect(screen.getByRole('alert').textContent).toContain('Use a year');
  expect(lastSearch(archive)).toMatchObject({ rules: [] });

  fireEvent.change(date, { target: { value: '2026-09' } });
  expect(screen.queryByRole('alert')).toBeNull();
  await waitFor(() => {
    expect(lastSearch(archive)).toMatchObject({
      rules: [{ kind: 'shot-after', date: '2026-09' }],
    });
  });

  fireEvent.change(date, { target: { value: '2026-0' } });
  await waitFor(() => {
    expect(lastSearch(archive)).toMatchObject({ rules: [] });
  });
});

test('has rules need no value, and each has its own remove button', async () => {
  const archive = aTwoRollArchive();
  show(archive);
  await screen.findByText('3 frames match');

  addRule('Has a Final');
  addRule('Has a Raw scan');

  await waitFor(() => {
    expect(lastSearch(archive)).toMatchObject({
      rules: [
        { kind: 'has', version: 'final' },
        { kind: 'has', version: 'raw-scan' },
      ],
    });
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove rule: Has a Final' }),
  );
  await waitFor(() => {
    expect(lastSearch(archive)).toMatchObject({
      rules: [{ kind: 'has', version: 'raw-scan' }],
    });
  });
});

test('puts a page’s own actions on each frame, and greys out the excluded, still in their place', async () => {
  const archive = aTwoRollArchive();
  show(archive, everyFrame, true);
  await screen.findByText('3 frames match');

  fireEvent.click(screen.getByRole('button', { name: 'Exclude 0002' }));

  expect(await screen.findByText('2 frames match, 1 excluded')).toBeTruthy();
  expect(lastSearch(archive)).toMatchObject({
    excluded: [{ frameId: '01JC8Z7K3M00000000000F0002' }],
  });
  const excluded = screen.getByRole('link', { name: 'Roll 2026-001, frame 2' });
  expect(excluded.closest('li')?.className).toContain('excluded');
  expect(screen.getAllByRole('link')).toHaveLength(3);
});

test('says so when the frames cannot be found', async () => {
  const archive = aTwoRollArchive();
  archive.stop();
  show(archive);

  expect(await screen.findByRole('alert')).toBeTruthy();
});
