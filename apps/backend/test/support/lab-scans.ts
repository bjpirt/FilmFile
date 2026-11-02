import sharp from 'sharp';

// Lab-style scans for tests: small JPEGs named BBBBNNNN.jpg (lab batch, scan
// index), each showing its frame number in seven-segment digits drawn with
// SVG shapes, so no fonts are needed.

const width = 240;
const height = 160;

// Which segments each character lights: a top, b top right, c bottom right,
// d bottom, e bottom left, f top left, g middle.
const segmentsFor: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  A: 'abcefg',
  '-': 'g',
};

const digit = { width: 28, height: 48, stroke: 6, gap: 8 };

function segmentRects(segments: string, x: number, y: number): string[] {
  const { width: w, height: h, stroke: t } = digit;
  const half = h / 2;
  const shapes: Record<string, [number, number, number, number]> = {
    a: [x + t, y, w - 2 * t, t],
    b: [x + w - t, y + t, t, half - t],
    c: [x + w - t, y + half, t, half - t],
    d: [x + t, y + h - t, w - 2 * t, t],
    e: [x, y + half, t, half - t],
    f: [x, y + t, t, half - t],
    g: [x + t, y + half - t / 2, w - 2 * t, t],
  };
  return Array.from(segments, (segment) => {
    const [sx, sy, sw, sh] = shapes[segment] ?? [0, 0, 0, 0];
    return `<rect x="${String(sx)}" y="${String(sy)}" width="${String(sw)}" height="${String(sh)}" fill="#fff"/>`;
  });
}

/** A small JPEG showing the frame number, as on the film's rebate. */
export async function aLabScan(frameNumber: string): Promise<Uint8Array> {
  const textWidth = frameNumber.length * (digit.width + digit.gap) - digit.gap;
  const left = (width - textWidth) / 2;
  const top = (height - digit.height) / 2;
  const rects = Array.from(frameNumber).flatMap((character, i) => {
    const segments = segmentsFor[character];
    if (segments === undefined) {
      throw new Error(`can't draw ${character}`);
    }
    return segmentRects(segments, left + i * (digit.width + digit.gap), top);
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}"><rect width="100%" height="100%" fill="#333"/>${rects.join('')}</svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg().toBuffer());
}

export interface FixtureSet {
  readonly batch: string;
  /** In scan order, each with the frame number it shows. */
  readonly scans: readonly {
    readonly name: string;
    readonly frameNumber: string;
  }[];
}

function scansOf(batch: string, frameNumbers: readonly string[]): FixtureSet {
  return {
    batch,
    scans: frameNumbers.map((frameNumber, i) => ({
      name: `${batch}${String(i + 1).padStart(4, '0')}.jpg`,
      frameNumber,
    })),
  };
}

/** The cases numbering has to handle, one lab batch each. */
export const fixtureSets = {
  headToTail: scansOf('1234', ['1', '2', '3', '4', '5', '6']),
  tailToHead: scansOf('1235', ['6', '5', '4', '3', '2', '1']),
  labSkippedFrame: scansOf('1236', ['1', '2', '3', '5', '6']),
  startingAt00: scansOf('1237', ['00', '0', '1', '2', '3', '4']),
  with12A: scansOf('1238', ['10', '11', '12', '12A', '13', '14']),
} as const satisfies Record<string, FixtureSet>;

/** A fixture set's scans as files: name and JPEG bytes. */
export function labScans(
  set: FixtureSet,
): Promise<{ readonly name: string; readonly bytes: Uint8Array }[]> {
  return Promise.all(
    set.scans.map(async ({ name, frameNumber }) => ({
      name,
      bytes: await aLabScan(frameNumber),
    })),
  );
}
