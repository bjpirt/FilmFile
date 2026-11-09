import { describe, expect, test } from 'vitest';
import { InMemoryRollRepository } from '../../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import type {
  BlobStore,
  ReadOnlyResult,
} from '../../../src/application/ports/blob-store.ts';
import { ProtectOriginals } from '../../../src/application/use-cases/originals/protect-originals.ts';
import {
  aFrame,
  aRoll,
  aVersion,
  ctx,
  ulidFor,
} from '../../support/builders.ts';

/** A blob store that answers as told for each file, and remembers what it was asked. */
class FakeBlobStore implements BlobStore {
  readonly asked: string[] = [];
  readonly #answers: Readonly<Record<string, ReadOnlyResult>>;

  constructor(answers: Readonly<Record<string, ReadOnlyResult>>) {
    this.#answers = answers;
  }

  put(): Promise<string> {
    return Promise.reject(new Error('not used'));
  }

  get(): Promise<Uint8Array> {
    return Promise.reject(new Error('not used'));
  }

  makeReadOnly(
    _ctx: unknown,
    _rollId: string,
    file: string,
  ): Promise<ReadOnlyResult> {
    this.asked.push(file);
    return Promise.resolve(this.#answers[file] ?? 'already');
  }
}

describe('ProtectOriginals', () => {
  async function rollsWith(files: string[]) {
    const rolls = new InMemoryRollRepository();
    await rolls.create(
      ctx,
      aRoll({
        frames: files.map((file, i) =>
          aFrame({
            id: ulidFor(10 + i),
            versions: [aVersion({ id: ulidFor(30 + i), file })],
          }),
        ),
      }),
    );
    return rolls;
  }

  test('makes every version’s file read-only, counting those it changed and those it couldn’t', async () => {
    const rolls = await rollsWith(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);
    const blobs = new FakeBlobStore({
      'a.jpg': 'changed',
      'b.jpg': 'already',
      'c.jpg': 'failed',
      'd.jpg': 'missing',
    });

    const done = await new ProtectOriginals(rolls, blobs).execute(ctx);

    expect(done).toEqual({ changed: 1, couldNotChange: 2 });
    expect(blobs.asked).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);
  });

  test('has nothing to do for an archive with no rolls', async () => {
    const done = await new ProtectOriginals(
      new InMemoryRollRepository(),
      new FakeBlobStore({}),
    ).execute(ctx);

    expect(done).toEqual({ changed: 0, couldNotChange: 0 });
  });
});
