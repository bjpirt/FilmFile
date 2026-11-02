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

type Outcome = 'uploaded' | 'already-in-roll' | { readonly reason: string };

async function uploadScan(
  api: ApiClient,
  rollId: string,
  file: File,
  inRoll: ReadonlySet<string>,
): Promise<Outcome> {
  // Checked here so a refused name doesn't leave an empty frame behind.
  const name = addVersionQuery.shape.file.safeParse(file.name);
  if (!name.success) {
    return { reason: name.error.issues[0]?.message ?? 'name not accepted' };
  }
  if (inRoll.has(await sha256(file))) {
    return 'already-in-roll';
  }

  const frame = await api.POST('/api/rolls/{rollId}/frames', {
    params: { path: { rollId } },
    body: {},
  });
  if (frame.data === undefined) {
    return { reason: "the service didn't create a frame" };
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
    return 'uploaded';
  }
  return version.response.status === 409
    ? 'already-in-roll'
    : { reason: "the service didn't accept it" };
}

/**
 * Adds each scan to the roll as a new frame, in file name order. One at a time:
 * until the service locks rolls (task H.9), parallel changes to a roll can be lost.
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

  let uploaded = 0;
  let alreadyInRoll = 0;
  const failed: { file: string; reason: string }[] = [];
  for (const [index, file] of ordered.entries()) {
    const outcome = await uploadScan(api, roll.id, file, inRoll);
    if (outcome === 'uploaded') {
      uploaded += 1;
    } else if (outcome === 'already-in-roll') {
      alreadyInRoll += 1;
    } else {
      failed.push({ file: file.name, reason: outcome.reason });
    }
    onProgress(index + 1);
  }
  return { uploaded, alreadyInRoll, failed };
}
