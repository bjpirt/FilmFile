import { crc32 } from 'node:zlib';

/** A file read back out of a zip. */
export interface ZipFile {
  readonly name: string;
  readonly data: Buffer;
}

/**
 * Reads the files of a zip the way an unzipper does, by its directory at the
 * end, checking each file's CRC with Node's own, so a test knows the zip
 * would open anywhere.
 */
export function readZip(zip: Uint8Array): ZipFile[] {
  const bytes = Buffer.from(zip);
  const endAt = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endAt < 0) {
    throw new Error('not a zip: no end of directory');
  }
  const count = bytes.readUInt16LE(endAt + 10);
  let entry = bytes.readUInt32LE(endAt + 16);
  const files: ZipFile[] = [];
  for (let i = 0; i < count; i += 1) {
    if (bytes.readUInt32LE(entry) !== 0x02014b50) {
      throw new Error('not a zip: bad directory entry');
    }
    const method = bytes.readUInt16LE(entry + 10);
    const crc = bytes.readUInt32LE(entry + 16);
    const size = bytes.readUInt32LE(entry + 24);
    const nameLength = bytes.readUInt16LE(entry + 28);
    const extraLength = bytes.readUInt16LE(entry + 30);
    const commentLength = bytes.readUInt16LE(entry + 32);
    const local = bytes.readUInt32LE(entry + 42);
    const name = bytes.toString('utf8', entry + 46, entry + 46 + nameLength);
    if (method !== 0 || bytes.readUInt32LE(local) !== 0x04034b50) {
      throw new Error(`${name}: not stored, or no local header`);
    }
    const start =
      local +
      30 +
      bytes.readUInt16LE(local + 26) +
      bytes.readUInt16LE(local + 28);
    const data = bytes.subarray(start, start + size);
    if (crc32(data) !== crc) {
      throw new Error(`${name}: wrong CRC`);
    }
    files.push({ name, data });
    entry += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
