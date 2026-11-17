import { describe, expect, test } from 'vitest';
import { filesAlreadyInBucket } from './files-already-in-bucket.ts';

const file = (path: string, md5 = 'aa', size = 10) => ({
  path,
  size,
  md5,
  sha256: `sha-of-${path}`,
});
const listed = (key: string, md5 = 'aa', size = 10) => ({ key, size, md5 });

describe('filesAlreadyInBucket', () => {
  test.each([
    ['at the same path, size and MD5, is found', listed('a'), true],
    ['with another MD5 is sent', listed('a', 'bb'), false],
    ['with another size is sent', listed('a', 'aa', 11), false],
    ['at another path is sent', listed('b'), false],
    [
      'whose ETag is not an MD5 (a multi-part upload) is sent',
      listed('a', 'aa-2'),
      false,
    ],
  ])('a file %s', (_, inBucket, found) => {
    const split = filesAlreadyInBucket({
      uploads: [file('a')],
      listing: [inBucket],
    });

    expect(split.found.length === 1).toBe(found);
    expect(split.uploads.length === 1).toBe(!found);
  });

  test('keeps the order of the uploads in both', () => {
    const split = filesAlreadyInBucket({
      uploads: [file('a'), file('b'), file('c'), file('d')],
      listing: [listed('d'), listed('b')],
    });

    expect(split.uploads.map((f) => f.path)).toEqual(['a', 'c']);
    expect(split.found.map((f) => f.path)).toEqual(['b', 'd']);
  });
});
