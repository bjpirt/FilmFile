import { expect, test } from 'vitest';
import {
  exportFinishedMessage,
  handleServiceMessage,
  type ServiceRequests,
} from './service-messages.ts';

function aSetOfRequests(folder: string | undefined) {
  const finished: unknown[] = [];
  const requests: ServiceRequests = {
    chooseExportFolder: () => Promise.resolve(folder),
    exportFinished: (result) => {
      finished.push(result);
    },
  };
  return { requests, finished };
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
