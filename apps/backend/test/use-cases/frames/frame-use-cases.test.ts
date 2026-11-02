import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { FixedClock } from '../../../src/adapters/outbound/memory/fixed-clock.ts';
import { InMemoryBlobStore } from '../../../src/adapters/outbound/memory/in-memory-blob-store.ts';
import { InMemoryPreviewProvider } from '../../../src/adapters/outbound/memory/in-memory-preview-provider.ts';
import { InMemoryRollRepository } from '../../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { SequentialIdGenerator } from '../../../src/adapters/outbound/memory/sequential-id-generator.ts';
import { SharpImageInspector } from '../../../src/adapters/outbound/sharp/sharp-image-inspector.ts';
import { AddVersion } from '../../../src/application/use-cases/frames/add-version.ts';
import { CreateFrame } from '../../../src/application/use-cases/frames/create-frame.ts';
import { GetOriginal } from '../../../src/application/use-cases/frames/get-original.ts';
import { GetThumbnail } from '../../../src/application/use-cases/frames/get-thumbnail.ts';
import { UpdateFrame } from '../../../src/application/use-cases/frames/update-frame.ts';
import { CreateRoll } from '../../../src/application/use-cases/rolls/create-roll.ts';
import type { ArchiveContext } from '../../../src/domain/shared/archive-context.ts';
import {
  isArchiveId,
  isFrameId,
  isRollId,
  isVersionId,
  type FrameId,
  type RollId,
} from '../../../src/domain/shared/ids.ts';
import { aJpeg } from '../../support/a-jpeg.ts';
import { checked } from '../../support/checked.ts';

const ctx: ArchiveContext = {
  archiveId: checked('00000000000000000000000000', isArchiveId),
};
const missing = '01JC8Z7K3M0000000000000000';

async function setUp() {
  const rolls = new InMemoryRollRepository();
  const blobs = new InMemoryBlobStore();
  const previews = new InMemoryPreviewProvider();
  const ids = new SequentialIdGenerator();
  const clock = new FixedClock('2026-11-02T12:00:00.000Z');
  const created = await new CreateRoll(rolls, ids).execute(ctx, {
    roll: '2026-014',
  });
  if (!created.ok) {
    throw new Error('setup failed');
  }
  return {
    rolls,
    previews,
    roll: created.value,
    createFrame: new CreateFrame(rolls, ids),
    addVersion: new AddVersion(
      rolls,
      blobs,
      new SharpImageInspector(1_000_000),
      ids,
      clock,
    ),
    getOriginal: new GetOriginal(rolls, blobs),
    getThumbnail: new GetThumbnail(rolls, blobs, previews),
    updateFrame: new UpdateFrame(rolls),
  };
}

async function aFrameIn(
  createFrame: CreateFrame,
  rollId: RollId,
): Promise<FrameId> {
  const frame = await createFrame.execute(ctx, { rollId });
  if (!frame.ok) {
    throw new Error('setup failed');
  }
  return frame.value.id;
}

describe('CreateFrame', () => {
  test('adds a frame, with its number, to the end of the roll', async () => {
    const { rolls, roll, createFrame } = await setUp();
    await createFrame.execute(ctx, { rollId: roll.id, number: '1' });

    const created = await createFrame.execute(ctx, {
      rollId: roll.id,
      number: '2',
    });

    expect(created).toEqual({
      ok: true,
      value: { id: '00000000000000000000000003', number: '2', versions: [] },
    });
    expect(
      (await rolls.get(ctx, roll.id))?.roll.frames.map((f) => f.number),
    ).toEqual(['1', '2']);
  });

  test('leaves the number empty when none is given', async () => {
    const { roll, createFrame } = await setUp();

    const created = await createFrame.execute(ctx, { rollId: roll.id });

    expect(created.ok && created.value.number).toBeNull();
  });

  test('says when the roll does not exist', async () => {
    const { createFrame } = await setUp();

    expect(
      await createFrame.execute(ctx, { rollId: checked(missing, isRollId) }),
    ).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'roll', id: missing },
    });
  });
});

describe('UpdateFrame', () => {
  async function withAFrame() {
    const setup = await setUp();
    const frameId = await aFrameIn(setup.createFrame, setup.roll.id);
    const read = await setup.rolls.get(ctx, setup.roll.id);
    return { ...setup, frameId, version: read?.version ?? '' };
  }

  test('sets the frame number, and gives the roll’s new version', async () => {
    const { rolls, roll, frameId, version, updateFrame } = await withAFrame();

    const updated = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
      number: '12A',
    });

    const after = await rolls.get(ctx, roll.id);
    expect(updated).toEqual({
      ok: true,
      value: {
        frame: { id: frameId, number: '12A', versions: [] },
        version: after?.version,
      },
    });
    expect(after?.roll.frames[0]?.number).toBe('12A');
  });

  test('clears the frame number', async () => {
    const { roll, frameId, version, updateFrame } = await withAFrame();

    const updated = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
      number: null,
    });

    expect(updated.ok && updated.value.frame.number).toBeNull();
  });

  test('refuses a number over 9 characters', async () => {
    const { roll, frameId, version, updateFrame } = await withAFrame();

    expect(
      await updateFrame.execute(ctx, {
        rollId: roll.id,
        frameId,
        expectedVersion: version,
        number: '1234567890',
      }),
    ).toMatchObject({ ok: false, error: { kind: 'validation-failed' } });
  });

  test('refuses when the roll changed since it was read', async () => {
    const { roll, frameId, version, createFrame, updateFrame } =
      await withAFrame();
    await createFrame.execute(ctx, { rollId: roll.id });

    expect(
      await updateFrame.execute(ctx, {
        rollId: roll.id,
        frameId,
        expectedVersion: version,
        number: '1',
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'concurrency-conflict', entity: 'roll', id: roll.id },
    });
  });

  test.each([
    ['roll', missing, '00000000000000000000000002'],
    ['frame', '00000000000000000000000001', missing],
  ])('says when the %s does not exist', async (entity, rollId, frameId) => {
    const { version, updateFrame } = await withAFrame();

    expect(
      await updateFrame.execute(ctx, {
        rollId: checked(rollId, isRollId),
        frameId: checked(frameId, isFrameId),
        expectedVersion: version,
        number: '1',
      }),
    ).toEqual({ ok: false, error: { kind: 'not-found', entity, id: missing } });
  });
});

describe('AddVersion', () => {
  test('stores the file and records it as a version of the frame', async () => {
    const { rolls, roll, createFrame, addVersion } = await setUp();
    const frameId = await aFrameIn(createFrame, roll.id);
    const scan = new Uint8Array(await aJpeg({ width: 30, height: 20 }));

    const added = await addVersion.execute(ctx, {
      rollId: roll.id,
      frameId,
      fileName: '12340014.jpg',
      bytes: scan,
    });

    const version = {
      id: '00000000000000000000000003',
      file: '00000000000000000000000002/00000000000000000000000003/12340014.jpg',
      sha256: createHash('sha256').update(scan).digest('hex'),
      bytes: scan.length,
      width: 30,
      height: 20,
      added: new Date('2026-11-02T12:00:00.000Z'),
    };
    expect(added).toEqual({ ok: true, value: version });
    expect((await rolls.get(ctx, roll.id))?.roll.frames[0]?.versions).toEqual([
      version,
    ]);
  });

  test('refuses a file already in the roll, naming the frame that has it', async () => {
    const { roll, createFrame, addVersion } = await setUp();
    const first = await aFrameIn(createFrame, roll.id);
    const second = await aFrameIn(createFrame, roll.id);
    const scan = new Uint8Array(await aJpeg());
    await addVersion.execute(ctx, {
      rollId: roll.id,
      frameId: first,
      fileName: '12340014.jpg',
      bytes: scan,
    });

    expect(
      await addVersion.execute(ctx, {
        rollId: roll.id,
        frameId: second,
        fileName: '12340015.jpg',
        bytes: scan,
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'scan-already-in-roll', frameId: first },
    });
  });

  test('refuses a file the inspector rejects', async () => {
    const { roll, createFrame, addVersion } = await setUp();
    const frameId = await aFrameIn(createFrame, roll.id);

    expect(
      await addVersion.execute(ctx, {
        rollId: roll.id,
        frameId,
        fileName: '12340014.jpg',
        bytes: new TextEncoder().encode('not an image'),
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'image-rejected', reason: 'not-jpeg' },
    });
  });

  test.each([
    ['roll', missing, '00000000000000000000000002'],
    ['frame', '00000000000000000000000001', missing],
  ])('says when the %s does not exist', async (entity, rollId, frameId) => {
    const { createFrame, roll, addVersion } = await setUp();
    await aFrameIn(createFrame, roll.id);

    expect(
      await addVersion.execute(ctx, {
        rollId: checked(rollId, isRollId),
        frameId: checked(frameId, isFrameId),
        fileName: '12340014.jpg',
        bytes: new Uint8Array(await aJpeg()),
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'not-found', entity, id: missing },
    });
  });
});

describe('GetOriginal and GetThumbnail', () => {
  async function withAVersion() {
    const setup = await setUp();
    const frameId = await aFrameIn(setup.createFrame, setup.roll.id);
    const scan = new Uint8Array(await aJpeg());
    const added = await setup.addVersion.execute(ctx, {
      rollId: setup.roll.id,
      frameId,
      fileName: '12340014.jpg',
      bytes: scan,
    });
    if (!added.ok) {
      throw new Error('setup failed');
    }
    const ids = { rollId: setup.roll.id, frameId, versionId: added.value.id };
    return { ...setup, ids, scan };
  }

  test('GetOriginal returns the file exactly as it was added', async () => {
    const { getOriginal, ids, scan } = await withAVersion();

    expect(await getOriginal.execute(ctx, ids)).toEqual({
      ok: true,
      value: scan,
    });
  });

  test('GetThumbnail makes a thumbnail from the original once, then reuses it', async () => {
    const { getThumbnail, previews, ids } = await withAVersion();

    const first = await getThumbnail.execute(ctx, { ...ids, size: 'small' });
    const second = await getThumbnail.execute(ctx, { ...ids, size: 'small' });

    expect(first).toEqual(second);
    expect(first.ok && new TextDecoder().decode(first.value)).toMatch(
      /^small of /,
    );
    expect(previews.originalsLoaded).toBe(1);
  });

  test.each(['GetOriginal', 'GetThumbnail'])(
    '%s says when the version does not exist',
    async (useCase) => {
      const { getOriginal, getThumbnail, ids } = await withAVersion();
      const absent = { ...ids, versionId: checked(missing, isVersionId) };

      const result =
        useCase === 'GetOriginal'
          ? await getOriginal.execute(ctx, absent)
          : await getThumbnail.execute(ctx, { ...absent, size: 'small' });

      expect(result).toEqual({
        ok: false,
        error: { kind: 'not-found', entity: 'version', id: missing },
      });
    },
  );
});
