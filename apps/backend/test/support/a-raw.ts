import { aJpeg } from './a-jpeg.ts';

/**
 * A file laid out as a Sony ARW is: a little-endian TIFF whose first table
 * (IFD0) holds a small thumbnail size and the preview JPEG's place, and
 * whose sub-table holds the sensor's full size. Its "raw data" is left out.
 */
export async function aRaw(
  options: {
    readonly sensor?: { readonly width: number; readonly height: number };
    readonly preview?: { readonly width: number; readonly height: number };
  } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const sensor = options.sensor ?? { width: 6000, height: 4000 };
  const previewSize = options.preview ?? { width: 600, height: 400 };
  const preview = new Uint8Array(await aJpeg(previewSize));
  const ifd0 = 8;
  const ifd0Entries = 5;
  const subIfd = ifd0 + 2 + ifd0Entries * 12 + 4;
  const subIfdEntries = 2;
  const jpeg = subIfd + 2 + subIfdEntries * 12 + 4;
  const bytes = new Uint8Array(jpeg + preview.length);
  const view = new DataView(bytes.buffer);
  bytes.set([0x49, 0x49], 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, ifd0, true);

  function entries(at: number, list: readonly [number, number, number][]) {
    view.setUint16(at, list.length, true);
    list.forEach(([tag, type, value], i) => {
      const entry = at + 2 + i * 12;
      view.setUint16(entry, tag, true);
      view.setUint16(entry + 2, type, true);
      view.setUint32(entry + 4, 1, true);
      if (type === 3) {
        view.setUint16(entry + 8, value, true);
      } else {
        view.setUint32(entry + 8, value, true);
      }
    });
    view.setUint32(at + 2 + list.length * 12, 0, true);
  }

  const SHORT = 3;
  const LONG = 4;
  entries(ifd0, [
    [0x100, SHORT, 160],
    [0x101, SHORT, 120],
    [0x14a, LONG, subIfd],
    [0x201, LONG, jpeg],
    [0x202, LONG, preview.length],
  ]);
  entries(subIfd, [
    [0x100, LONG, sensor.width],
    [0x101, LONG, sensor.height],
  ]);
  bytes.set(preview, jpeg);
  return bytes;
}
