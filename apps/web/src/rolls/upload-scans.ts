import type { ApiClient } from '@filmfile/contracts/client';
import { addVersionQuery, type Roll } from '@filmfile/contracts/rolls';

export interface UploadReport {
  readonly uploaded: number;
  readonly alreadyInRoll: number;
  readonly failed: readonly {
    readonly file: string;
    readonly reason: string;
  }[];
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

// Whether a frame was created matters even when the upload fails: the frame
// is left empty, holding its frame number.
interface Outcome {
  readonly result: 'uploaded' | 'already-in-roll' | 'failed';
  readonly frameCreated: boolean;
  readonly reason?: string;
}

/**
 * The number after the highest plain number in the roll, or 1 for a roll with
 * none. A first guess until numbering is set from anchors (task 1.3.9).
 */
function nextFrameNumber(roll: Roll): number {
  const numbers = roll.frames
    .map((frame) => frame.number ?? '')
    .filter((number) => /^\d+$/.test(number))
    .map(Number);
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
}

async function uploadScan(
  api: ApiClient,
  rollId: string,
  file: File,
  number: number,
  inRoll: ReadonlySet<string>,
): Promise<Outcome> {
  // Checked here so a refused name doesn't leave an empty frame behind.
  const name = addVersionQuery.shape.file.safeParse(file.name);
  if (!name.success) {
    return {
      result: 'failed',
      frameCreated: false,
      reason: name.error.issues[0]?.message ?? 'name not accepted',
    };
  }
  if (inRoll.has(await sha256(file))) {
    return { result: 'already-in-roll', frameCreated: false };
  }

  const frame = await api.POST('/api/rolls/{rollId}/frames', {
    params: { path: { rollId } },
    body: { number: String(number) },
  });
  if (frame.data === undefined) {
    return {
      result: 'failed',
      frameCreated: false,
      reason: "the service didn't create a frame",
    };
  }

  const version = await api.POST(
    '/api/rolls/{rollId}/frames/{frameId}/versions',
    {
      params: {
        path: { rollId, frameId: frame.data.id },
        query: { file: file.name },
      },
      body: file,
      // Send the file as it is, not as JSON.
      bodySerializer: (body) => body,
      headers: { 'Content-Type': 'image/jpeg' },
    },
  );
  if (version.data !== undefined) {
    return { result: 'uploaded', frameCreated: true };
  }
  return version.response.status === 409
    ? { result: 'already-in-roll', frameCreated: true }
    : {
        result: 'failed',
        frameCreated: true,
        reason: "the service didn't accept it",
      };
}

/**
 * Adds each scan to the roll as a new frame, in file name order, numbered on
 * from the roll's highest frame number. One at a time, so frames are added
 * to the roll in file name order.
 */
export async function uploadScans(
  api: ApiClient,
  roll: Roll,
  files: readonly File[],
  onProgress: (done: number) => void,
): Promise<UploadReport> {
  const inRoll = new Set(
    roll.frames.flatMap((frame) => frame.versions.map((v) => v.sha256)),
  );
  const ordered = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );

  let number = nextFrameNumber(roll);
  let uploaded = 0;
  let alreadyInRoll = 0;
  const failed: { file: string; reason: string }[] = [];
  for (const [index, file] of ordered.entries()) {
    const outcome = await uploadScan(api, roll.id, file, number, inRoll);
    if (outcome.frameCreated) {
      number += 1;
    }
    switch (outcome.result) {
      case 'uploaded':
        uploaded += 1;
        break;
      case 'already-in-roll':
        alreadyInRoll += 1;
        break;
      case 'failed':
        failed.push({ file: file.name, reason: outcome.reason ?? 'unknown' });
        break;
    }
    onProgress(index + 1);
  }
  return { uploaded, alreadyInRoll, failed };
}
