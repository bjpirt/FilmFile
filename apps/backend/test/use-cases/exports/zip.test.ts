import { describe, expect, test } from 'vitest';
import {
  zipOf,
  type ZipEntry,
} from '../../../src/application/use-cases/exports/zip.ts';
import { readZip } from '../../support/read-zip.ts';

async function* entries(...list: ZipEntry[]): AsyncGenerator<ZipEntry> {
  await Promise.resolve();
  yield* list;
}

async function whole(parts: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const part of parts) {
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}

describe('zipOf', () => {
  test('writes the files, in folders and with any name, so a reader finds them as they were', async () => {
    const text = (value: string) => new TextEncoder().encode(value);
    const zip = await whole(
      zipOf(
        entries(
          { name: '2026/2026-014/2026-014-1.jpg', data: text('one') },
          { name: 'Café ☕.jpg', data: text('two') },
          { name: 'empty.txt', data: new Uint8Array() },
        ),
        new Date('2026-11-02T12:00:00'),
      ),
    );

    expect(
      readZip(zip).map(({ name, data }) => [name, data.toString()]),
    ).toEqual([
      ['2026/2026-014/2026-014-1.jpg', 'one'],
      ['Café ☕.jpg', 'two'],
      ['empty.txt', ''],
    ]);
  });

  test('is a zip with nothing in it when there are no files', async () => {
    expect(readZip(await whole(zipOf(entries(), new Date())))).toEqual([]);
  });

  test('makes each file only when the next part is asked for', async () => {
    const made: string[] = [];
    async function* lazy(): AsyncGenerator<ZipEntry> {
      await Promise.resolve();
      for (const name of ['a', 'b', 'c']) {
        made.push(name);
        yield { name, data: new Uint8Array([1]) };
      }
    }
    const parts = zipOf(lazy(), new Date());

    await parts.next();
    expect(made).toEqual(['a']);
    await parts.return(undefined);
    expect(made).toEqual(['a']);
  });
});
