import { expect, test } from 'vitest';
import {
  exportFinishedMessage,
  handleServiceMessage,
  type ServiceRequests,
} from './service-messages.ts';

function aSetOfRequests(folder: string | undefined) {
  const finished: unknown[] = [];
  const kept: { sync: unknown } = { sync: undefined };
  const requests: ServiceRequests = {
    syncSettings: () =>
      Promise.resolve(
        kept.sync === undefined
          ? undefined
          : {
              bucket: 'backup-pirt',
              computerName: 'Studio',
              lastSync: null,
            },
      ),
    saveSyncSettings: (settings) => {
      kept.sync = settings;
      return Promise.resolve();
    },
    chooseExportFolder: () => Promise.resolve(folder),
    exportFinished: (result) => {
      finished.push(result);
    },
  };
  return { requests, finished, kept };
}

test('answers a request for a folder with the one chosen, tying the answer to the question', async () => {
  const { requests } = aSetOfRequests('/Users/ben/Pictures');
  const replies: unknown[] = [];

  await handleServiceMessage(
    { type: 'choose-export-folder', id: 7 },
    requests,
    (answer) => replies.push(answer),
  );

  expect(replies).toEqual([
    { type: 'export-folder', id: 7, folder: '/Users/ben/Pictures' },
  ]);
});

test('answers with no folder when the person cancels', async () => {
  const { requests } = aSetOfRequests(undefined);
  const replies: unknown[] = [];

  await handleServiceMessage(
    { type: 'choose-export-folder', id: 1 },
    requests,
    (answer) => replies.push(answer),
  );

  expect(replies).toEqual([{ type: 'export-folder', id: 1, folder: null }]);
});

test('passes on that an export is finished', async () => {
  const { requests, finished } = aSetOfRequests(undefined);

  await handleServiceMessage(
    { type: 'export-finished', folder: '/x', written: 3, leftOut: 1 },
    requests,
    () => undefined,
  );

  expect(finished).toEqual([{ folder: '/x', written: 3, leftOut: 1 }]);
});

test.each([
  ['text', 'hello'],
  ['nothing', null],
  ['an unknown type', { type: 'other' }],
  ['a request with no ID', { type: 'choose-export-folder' }],
  [
    'a finish with no folder',
    { type: 'export-finished', written: 1, leftOut: 0 },
  ],
])('ignores %s', async (_what, message) => {
  const { requests, finished } = aSetOfRequests('/x');
  const replies: unknown[] = [];

  await handleServiceMessage(message, requests, (answer) =>
    replies.push(answer),
  );

  expect([replies, finished]).toEqual([[], []]);
});

test('says where the files went, and how many frames were left out, when some were', () => {
  expect(
    exportFinishedMessage({
      folder: '/Users/ben/Pictures',
      written: 10,
      leftOut: 2,
    }),
  ).toEqual({
    message: 'Saved 10 files to /Users/ben/Pictures',
    detail:
      '2 frames were left out; skipped.txt in the folder says which and why.',
  });
  expect(
    exportFinishedMessage({ folder: '/x', written: 1, leftOut: 0 }),
  ).toEqual({ message: 'Saved 1 file to /x' });
  expect(
    exportFinishedMessage({ folder: '/x', written: 3, leftOut: 1 }).detail,
  ).toBe('1 frame was left out; skipped.txt in the folder says which and why.');
});

test('answers a request for the sync settings with none set, then keeps those the service saves', async () => {
  const { requests, kept } = aSetOfRequests(undefined);
  const replies: unknown[] = [];
  const reply = (answer: unknown) => replies.push(answer);
  const settings = {
    bucket: 'backup-pirt',
    computerName: 'Studio',
    lastSync: null,
  };

  await handleServiceMessage(
    { type: 'get-sync-settings', id: 1 },
    requests,
    reply,
  );
  await handleServiceMessage(
    { type: 'save-sync-settings', id: 2, settings },
    requests,
    reply,
  );
  await handleServiceMessage(
    { type: 'get-sync-settings', id: 3 },
    requests,
    reply,
  );

  expect(kept.sync).toEqual(settings);
  expect(replies).toEqual([
    {
      type: 'sync-settings',
      id: 1,
      settings: { bucket: null, computerName: null, lastSync: null },
    },
    { type: 'sync-settings-saved', id: 2 },
    { type: 'sync-settings', id: 3, settings },
  ]);
});

test('keeps nothing the service sends that isn’t sync settings, but still answers', async () => {
  const { requests, kept } = aSetOfRequests(undefined);
  const replies: unknown[] = [];

  await handleServiceMessage(
    { type: 'save-sync-settings', id: 4, settings: { bucket: 7 } },
    requests,
    (answer) => replies.push(answer),
  );

  expect(kept.sync).toBeUndefined();
  expect(replies).toEqual([{ type: 'sync-settings-saved', id: 4 }]);
});
