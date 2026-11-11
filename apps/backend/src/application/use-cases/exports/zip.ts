/** One file to go in a zip. */
export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit += 1) {
    c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A date and time as a zip stores them: two 16-bit numbers, to the nearest two seconds. */
function dosTime(at: Date): { readonly date: number; readonly time: number } {
  return {
    date:
      (Math.max(at.getFullYear() - 1980, 0) << 9) |
      ((at.getMonth() + 1) << 5) |
      at.getDate(),
    time:
      (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
  };
}

/** A block of bytes written with a DataView, little-endian as zips are. */
function block(size: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}

const utf8 = new TextEncoder();

/**
 * A store-only zip (JPEGs don't compress) made as a stream: each file's
 * header and bytes are yielded as soon as the file is there, then the
 * directory at the end. Nothing is kept but what the directory needs, so a
 * zip of many photographs is never held whole, and a download that's
 * cancelled stops the entries being made. Names are UTF-8; sizes and counts
 * are those of a plain zip (4 GB a file, 65,535 files).
 */
export async function* zipOf(
  entries: AsyncIterable<ZipEntry>,
  modified: Date,
): AsyncGenerator<Uint8Array> {
  const { date, time } = dosTime(modified);
  const directory: Uint8Array[] = [];
  let offset = 0;
  for await (const { name, data } of entries) {
    const fileName = utf8.encode(name);
    const crc = crc32(data);
    const utf8Names = 0x0800;
    const header = block(30 + fileName.length, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, utf8Names, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, time, true);
      view.setUint16(12, date, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, fileName.length, true);
    });
    header.set(fileName, 30);
    directory.push(
      block(46 + fileName.length, (view) => {
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 20, true);
        view.setUint16(8, utf8Names, true);
        view.setUint16(10, 0, true);
        view.setUint16(12, time, true);
        view.setUint16(14, date, true);
        view.setUint32(16, crc, true);
        view.setUint32(20, data.length, true);
        view.setUint32(24, data.length, true);
        view.setUint16(28, fileName.length, true);
        view.setUint32(42, offset, true);
      }),
    );
    directory.at(-1)?.set(fileName, 46);
    yield header;
    yield data;
    offset += header.length + data.length;
  }
  const size = directory.reduce((total, part) => total + part.length, 0);
  yield* directory;
  yield block(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, directory.length, true);
    view.setUint16(10, directory.length, true);
    view.setUint32(12, size, true);
    view.setUint32(16, offset, true);
  });
}
