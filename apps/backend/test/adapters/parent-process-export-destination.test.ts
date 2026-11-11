import { describe, expect, test } from 'vitest';
import {
  ParentProcessExportDestination,
  type ParentChannel,
} from '../../src/adapters/outbound/node/parent-process-export-destination.ts';

/** A channel to a parent that the test answers by hand. */
function aParent() {
  const sent: unknown[] = [];
  let listener: ((message: { data: unknown }) => void) | undefined;
  const parent: ParentChannel = {
    postMessage: (message) => {
      sent.push(message);
    },
    on: (_event, handler) => {
      listener = handler;
    },
  };
  return {
    parent,
    sent,
    answer: (data: unknown) => {
      listener?.({ data });
    },
  };
}

describe('ParentProcessExportDestination', () => {
  test('asks the parent for a folder and gives back a folder to write into', async () => {
    const { parent, sent, answer } = aParent();
    const destination = new ParentProcessExportDestination(parent);

    const asking = destination.choose();
    expect(sent).toEqual([{ type: 'choose-export-folder', id: 1 }]);
    answer({ type: 'export-folder', id: 1, folder: '/Users/ben/Pictures' });

    expect((await asking)?.path).toBe('/Users/ben/Pictures');
  });

  test('gives back nothing when the person cancels', async () => {
    const { parent, answer } = aParent();
    const destination = new ParentProcessExportDestination(parent);

    const asking = destination.choose();
    answer({ type: 'export-folder', id: 1, folder: null });

    expect(await asking).toBeUndefined();
  });

  test('matches each answer to its question, and ignores what is not an answer', async () => {
    const { parent, answer } = aParent();
    const destination = new ParentProcessExportDestination(parent);

    const first = destination.choose();
    const second = destination.choose();
    answer('nonsense');
    answer({ type: 'export-folder', id: 99, folder: '/nowhere' });
    answer({ type: 'export-folder', id: 2, folder: '/two' });
    answer({ type: 'export-folder', id: 1, folder: '/one' });

    expect([(await first)?.path, (await second)?.path]).toEqual([
      '/one',
      '/two',
    ]);
  });

  test('tells the parent when an export is finished', () => {
    const { parent, sent } = aParent();

    new ParentProcessExportDestination(parent).finished({
      folder: '/Users/ben/Pictures',
      written: 10,
      leftOut: 2,
    });

    expect(sent).toEqual([
      {
        type: 'export-finished',
        folder: '/Users/ben/Pictures',
        written: 10,
        leftOut: 2,
      },
    ]);
  });

  test('has no destination in a process that has no parent', () => {
    expect(ParentProcessExportDestination.ofThisProcess()).toBeUndefined();
  });
});
