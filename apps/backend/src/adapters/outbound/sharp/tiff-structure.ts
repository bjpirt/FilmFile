// What a TIFF says about itself in its tables (IFDs), read without decoding
// any image: its largest image's size, and any JPEG previews it carries. A
// Sony ARW is a TIFF whose first table points at a preview JPEG and whose
// sub-table holds the sensor's full size (U20). Uploaded files are
// untrusted, so every offset is checked against the file and the number of
// tables read is limited.

/** A JPEG inside the file: where it starts and how long it is. */
export interface EmbeddedJpeg {
  readonly offset: number;
  readonly length: number;
}

export interface TiffStructure {
  /** The largest image any table describes, e.g. a raw's sensor size. */
  readonly largest:
    { readonly width: number; readonly height: number } | undefined;
  /** JPEG previews the file carries, in the order found. */
  readonly previews: readonly EmbeddedJpeg[];
}

const tags = {
  imageWidth: 0x100,
  imageLength: 0x101,
  subIfds: 0x14a,
  jpegOffset: 0x201,
  jpegLength: 0x202,
} as const;

const SHORT = 3;
const LONG = 4;
const IFD = 13;
const maxTables = 64;
const maxEntries = 1000;

/** The structure of a TIFF, little- or big-endian; undefined for anything else. */
export function readTiffStructure(
  bytes: Uint8Array,
): TiffStructure | undefined {
  if (bytes.length < 8) {
    return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = bytes[0] === 0x49 && bytes[1] === 0x49;
  const big = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if ((!little && !big) || view.getUint16(2, little) !== 42) {
    return undefined;
  }
  const fits = (at: number, length: number) =>
    at >= 0 && length >= 0 && at + length <= bytes.length;
  const u16 = (at: number) =>
    fits(at, 2) ? view.getUint16(at, little) : undefined;
  const u32 = (at: number) =>
    fits(at, 4) ? view.getUint32(at, little) : undefined;

  let largest: TiffStructure['largest'];
  const previews: EmbeddedJpeg[] = [];
  const queue = [u32(4)];
  const seen = new Set<number>();

  while (queue.length > 0 && seen.size < maxTables) {
    const table = queue.shift();
    if (table === undefined || table === 0 || seen.has(table)) {
      continue;
    }
    seen.add(table);
    const count = u16(table);
    if (count === undefined || count > maxEntries) {
      continue;
    }
    let width: number | undefined;
    let height: number | undefined;
    let jpegOffset: number | undefined;
    let jpegLength: number | undefined;
    for (let i = 0; i < count; i += 1) {
      const entry = table + 2 + i * 12;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const values = u32(entry + 4);
      const value = type === SHORT ? u16(entry + 8) : u32(entry + 8);
      if (tag === undefined || values === undefined || value === undefined) {
        break;
      }
      switch (tag) {
        case tags.imageWidth:
          width = value;
          break;
        case tags.imageLength:
          height = value;
          break;
        case tags.jpegOffset:
          jpegOffset = value;
          break;
        case tags.jpegLength:
          jpegLength = value;
          break;
        case tags.subIfds:
          if (type === LONG || type === IFD) {
            // One sub-table's offset sits in the entry; more are listed elsewhere.
            if (values === 1) {
              queue.push(value);
            } else {
              for (let j = 0; j < Math.min(values, maxTables); j += 1) {
                queue.push(u32(value + j * 4));
              }
            }
          }
          break;
      }
    }
    queue.push(u32(table + 2 + count * 12));
    if (
      width !== undefined &&
      height !== undefined &&
      width * height >
        (largest === undefined ? 0 : largest.width * largest.height)
    ) {
      largest = { width, height };
    }
    if (
      jpegOffset !== undefined &&
      jpegLength !== undefined &&
      jpegLength > 0 &&
      fits(jpegOffset, jpegLength) &&
      bytes[jpegOffset] === 0xff &&
      bytes[jpegOffset + 1] === 0xd8
    ) {
      previews.push({ offset: jpegOffset, length: jpegLength });
    }
  }
  return { largest, previews };
}
