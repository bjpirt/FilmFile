import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { apiFor } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request } = apiFor(archive);

const rollId = '01JC8Z7K3M0000000000000001';
const frameId = '01JC8Z7K3M0000000000000002';
const versionId = '01JC8Z7K3M0000000000000003';

/** A roll.json edited outside the service, with a version file pointing elsewhere. */
async function aRollWithVersionFile(file: string): Promise<void> {
  const folder = path.join(archive.path(), 'rolls/2026/2026-014');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(archive.path(), 'secret.txt'), 'secret');
  const roll = {
    schema: 1,
    id: rollId,
    roll: '2026-014',
    frames: [
      {
        id: frameId,
        number: '1',
        versions: [
          {
            id: versionId,
            file,
            sha256: 'a'.repeat(64),
            bytes: 6,
            width: 1,
            height: 1,
            added: '2026-11-02T12:00:00.000Z',
          },
        ],
      },
    ],
  };
  await writeFile(path.join(folder, 'roll.json'), JSON.stringify(roll));
}

test.each([
  '../../../secret.txt',
  'frames/../../../../secret.txt',
  '/secret.txt',
])(
  'never serves a file outside the roll folder when roll.json says %s',
  async (file) => {
    await aRollWithVersionFile(file);

    const response = await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions/${versionId}/file`,
    );

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret');
  },
);
