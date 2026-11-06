import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { FixedClock } from '../../../src/adapters/outbound/memory/fixed-clock.ts';
import { InMemoryBlobStore } from '../../../src/adapters/outbound/memory/in-memory-blob-store.ts';
import { InMemoryEquipmentRepository } from '../../../src/adapters/outbound/memory/in-memory-equipment-repository.ts';
import { InMemoryEventRepository } from '../../../src/adapters/outbound/memory/in-memory-event-repository.ts';
import { InMemoryHoldingArea } from '../../../src/adapters/outbound/memory/in-memory-holding-area.ts';
import { InMemoryPreviewProvider } from '../../../src/adapters/outbound/memory/in-memory-preview-provider.ts';
import { InMemoryRollRepository } from '../../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { SequentialIdGenerator } from '../../../src/adapters/outbound/memory/sequential-id-generator.ts';
import { SharpImageInspector } from '../../../src/adapters/outbound/sharp/sharp-image-inspector.ts';
import type { HoldingArea } from '../../../src/application/ports/holding-area.ts';
import { AddVersion } from '../../../src/application/use-cases/frames/add-version.ts';
import { CreateFrame } from '../../../src/application/use-cases/frames/create-frame.ts';
import { DeleteFrame } from '../../../src/application/use-cases/frames/delete-frame.ts';
import { DeleteFrames } from '../../../src/application/use-cases/frames/delete-frames.ts';
import { DeleteVersion } from '../../../src/application/use-cases/frames/delete-version.ts';
import { GetOriginal } from '../../../src/application/use-cases/frames/get-original.ts';
import { GetThumbnail } from '../../../src/application/use-cases/frames/get-thumbnail.ts';
import { UpdateFrameNumbers } from '../../../src/application/use-cases/frames/update-frame-numbers.ts';
import { UpdateFrame } from '../../../src/application/use-cases/frames/update-frame.ts';
import { UpdateFrames } from '../../../src/application/use-cases/frames/update-frames.ts';
import { UpdateVersion } from '../../../src/application/use-cases/frames/update-version.ts';
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
import { aCamera, aLens, anEvent } from '../../support/builders.ts';
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
  const holding: HoldingArea = new InMemoryHoldingArea();
  const equipment = new InMemoryEquipmentRepository();
  const events = new InMemoryEventRepository();
  const created = await new CreateRoll(rolls, equipment, events, ids).execute(
    ctx,
    {
      roll: '2026-014',
      shot: '2026',
    },
  );
  if (!created.ok) {
    throw new Error('setup failed');
  }
  return {
    rolls,
    equipment,
    events,
    previews,
    holding,
    roll: created.value,
    deleteFrame: new DeleteFrame(rolls, holding, clock),
    deleteFrames: new DeleteFrames(rolls, holding, clock),
    deleteVersion: new DeleteVersion(rolls, holding, clock),
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
    updateFrame: new UpdateFrame(rolls, equipment, events),
    updateFrames: new UpdateFrames(rolls, equipment, events),
    updateVersion: new UpdateVersion(rolls),
    updateFrameNumbers: new UpdateFrameNumbers(rolls),
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
      value: {
        id: '00000000000000000000000003',
        number: '2',
        title: null,
        rating: null,
        notes: null,
        camera: null,
        lens: null,
        events: null,
        shot: null,
        defaultVersion: null,
        versions: [],
      },
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
        frame: {
          id: frameId,
          number: '12A',
          title: null,
          rating: null,
          notes: null,
          camera: null,
          lens: null,
          events: null,
          shot: null,
          defaultVersion: null,
          versions: [],
        },
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

  test('describes the frame with a title, rating and notes, trimmed', async () => {
    const { rolls, roll, frameId, version, updateFrame } = await withAFrame();

    const updated = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
      title: '  Mill pond, early fog ',
      rating: 4,
      notes: 'Pushed a stop.\n',
    });

    expect(updated).toMatchObject({
      ok: true,
      value: {
        frame: {
          title: 'Mill pond, early fog',
          rating: 4,
          notes: 'Pushed a stop.',
        },
      },
    });
    expect((await rolls.get(ctx, roll.id))?.roll.frames[0]).toMatchObject({
      title: 'Mill pond, early fog',
      rating: 4,
      notes: 'Pushed a stop.',
    });
  });

  test('clears the title, rating and notes with null or blank', async () => {
    const { roll, frameId, version, updateFrame } = await withAFrame();
    const described = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
      title: 'Mill pond',
      rating: 2,
      notes: 'Foggy',
    });

    const cleared = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: described.ok ? described.value.version : '',
      title: ' ',
      rating: null,
      notes: null,
    });

    expect(cleared).toMatchObject({
      ok: true,
      value: { frame: { title: null, rating: null, notes: null } },
    });
  });

  test.each([0, 6, 3.5])('refuses a rating of %d', async (rating) => {
    const { roll, frameId, version, updateFrame } = await withAFrame();

    expect(
      await updateFrame.execute(ctx, {
        rollId: roll.id,
        frameId,
        expectedVersion: version,
        rating,
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['rating'] }] },
    });
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

describe('UpdateFrame with the frame’s own details', () => {
  async function withAFrame() {
    const setup = await setUp();
    await setup.equipment.createCamera(ctx, aCamera('Leica', 'M6'));
    await setup.equipment.createLens(
      ctx,
      aLens('Leica', 'Summicron', { focalLength: 35, maxAperture: 2 }),
    );
    await setup.events.create(ctx, anEvent('Iceland 2026'));
    await setup.events.create(ctx, anEvent('Westfjords'));
    const frameId = await aFrameIn(setup.createFrame, setup.roll.id);
    const read = await setup.rolls.get(ctx, setup.roll.id);
    return { ...setup, frameId, version: read?.version ?? '' };
  }

  test('gives the frame its own camera, lens and events', async () => {
    const { rolls, roll, frameId, version, updateFrame } = await withAFrame();

    const updated = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
      camera: 'leica-m6',
      lens: aLens('Leica', 'Summicron', { focalLength: 35, maxAperture: 2 })
        .slug,
      events: ['westfjords', 'iceland-2026'],
    });

    const own = {
      camera: 'leica-m6',
      lens: aLens('Leica', 'Summicron', { focalLength: 35, maxAperture: 2 })
        .slug,
      events: ['westfjords', 'iceland-2026'],
    };
    expect(updated).toMatchObject({ ok: true, value: { frame: own } });
    expect((await rolls.get(ctx, roll.id))?.roll.frames[0]).toMatchObject(own);
  });

  test('gives the frame its own date shot, and goes back to the roll’s with null', async () => {
    const { roll, frameId, version, updateFrame } = await withAFrame();

    const dated = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
      shot: '2026-09-15T06:30',
    });
    expect(dated).toMatchObject({
      ok: true,
      value: { frame: { shot: '2026-09-15T06:30' } },
    });

    const cleared = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: dated.ok ? dated.value.version : '',
      shot: null,
    });
    expect(cleared).toMatchObject({
      ok: true,
      value: { frame: { shot: null } },
    });
  });

  test('refuses a date shot that isn’t a date', async () => {
    const { roll, frameId, version, updateFrame } = await withAFrame();

    expect(
      await updateFrame.execute(ctx, {
        rollId: roll.id,
        frameId,
        expectedVersion: version,
        shot: '2026-13-40',
      }),
    ).toMatchObject({ ok: false, error: { kind: 'validation-failed' } });
  });

  test('goes back to the roll’s with null', async () => {
    const { roll, frameId, version, updateFrame } = await withAFrame();
    const set = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
      camera: 'leica-m6',
      events: ['westfjords'],
    });

    const cleared = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: set.ok ? set.value.version : '',
      camera: null,
      events: null,
    });

    expect(cleared).toMatchObject({
      ok: true,
      value: { frame: { camera: null, events: null } },
    });
  });

  test.each([
    ['camera', { camera: 'nikon-f3' }],
    ['lens', { lens: 'zeiss-planar' }],
    ['events', { events: ['westfjords', 'nowhere'] }],
  ])(
    'refuses a %s not in the archive, saving nothing',
    async (path, change) => {
      const { rolls, roll, frameId, version, updateFrame } = await withAFrame();

      expect(
        await updateFrame.execute(ctx, {
          rollId: roll.id,
          frameId,
          expectedVersion: version,
          ...change,
        }),
      ).toMatchObject({
        ok: false,
        error: { kind: 'validation-failed', issues: [{ path: [path] }] },
      });
      expect((await rolls.get(ctx, roll.id))?.version).toBe(version);
    },
  );
});

describe('UpdateFrames', () => {
  async function withThreeFrames() {
    const setup = await setUp();
    await setup.equipment.createCamera(ctx, aCamera('Leica', 'M6'));
    await setup.events.create(ctx, anEvent('Westfjords'));
    const ids = [
      await aFrameIn(setup.createFrame, setup.roll.id),
      await aFrameIn(setup.createFrame, setup.roll.id),
      await aFrameIn(setup.createFrame, setup.roll.id),
    ];
    const read = await setup.rolls.get(ctx, setup.roll.id);
    return { ...setup, ids, version: read?.version ?? '' };
  }

  test('gives the frames chosen the same details in one save, leaving the rest', async () => {
    const { rolls, roll, ids, version, updateFrames } = await withThreeFrames();

    const updated = await updateFrames.execute(ctx, {
      rollId: roll.id,
      expectedVersion: version,
      frameIds: [ids[0] ?? '', ids[2] ?? ''],
      camera: 'leica-m6',
      events: ['westfjords'],
    });

    const after = await rolls.get(ctx, roll.id);
    expect(updated).toMatchObject({
      ok: true,
      value: { version: after?.version },
    });
    expect(
      after?.roll.frames.map((frame) => [frame.camera, frame.events]),
    ).toEqual([
      ['leica-m6', ['westfjords']],
      [null, null],
      ['leica-m6', ['westfjords']],
    ]);
  });

  test('goes back to the roll’s with null, leaving details not given', async () => {
    const { roll, ids, version, updateFrames } = await withThreeFrames();
    const set = await updateFrames.execute(ctx, {
      rollId: roll.id,
      expectedVersion: version,
      frameIds: ids,
      camera: 'leica-m6',
      events: ['westfjords'],
    });

    const cleared = await updateFrames.execute(ctx, {
      rollId: roll.id,
      expectedVersion: set.ok ? set.value.version : '',
      frameIds: ids,
      camera: null,
    });

    expect(
      cleared.ok &&
        cleared.value.roll.frames.map((frame) => [frame.camera, frame.events]),
    ).toEqual([
      [null, ['westfjords']],
      [null, ['westfjords']],
      [null, ['westfjords']],
    ]);
  });

  test('refuses equipment not in the archive, saving nothing', async () => {
    const { rolls, roll, ids, version, updateFrames } = await withThreeFrames();

    expect(
      await updateFrames.execute(ctx, {
        rollId: roll.id,
        expectedVersion: version,
        frameIds: ids,
        lens: 'zeiss-planar',
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['lens'] }] },
    });
    expect((await rolls.get(ctx, roll.id))?.version).toBe(version);
  });

  test('says when a frame isn’t in the roll, saving nothing', async () => {
    const { rolls, roll, ids, version, updateFrames } = await withThreeFrames();

    expect(
      await updateFrames.execute(ctx, {
        rollId: roll.id,
        expectedVersion: version,
        frameIds: [ids[0] ?? '', missing],
        camera: 'leica-m6',
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'frame', id: missing },
    });
    expect((await rolls.get(ctx, roll.id))?.version).toBe(version);
  });

  test('refuses when the roll changed since it was read', async () => {
    const { roll, ids, version, createFrame, updateFrames } =
      await withThreeFrames();
    await createFrame.execute(ctx, { rollId: roll.id });

    expect(
      await updateFrames.execute(ctx, {
        rollId: roll.id,
        expectedVersion: version,
        frameIds: ids,
        camera: 'leica-m6',
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'concurrency-conflict', entity: 'roll', id: roll.id },
    });
  });
});

describe('DeleteFrame', () => {
  async function withTwoFrames() {
    const setup = await setUp();
    const kept = await aFrameIn(setup.createFrame, setup.roll.id);
    const frameId = await aFrameIn(setup.createFrame, setup.roll.id);
    const read = await setup.rolls.get(ctx, setup.roll.id);
    return { ...setup, kept, frameId, version: read?.version ?? '' };
  }

  test('takes the frame out of the roll and holds it, with when and where from', async () => {
    const { rolls, holding, roll, kept, frameId, version, deleteFrame } =
      await withTwoFrames();
    const frame = (await rolls.get(ctx, roll.id))?.roll.frames.find(
      (f) => f.id === frameId,
    );

    const deleted = await deleteFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
    });

    const after = await rolls.get(ctx, roll.id);
    expect(deleted).toEqual({ ok: true, value: { version: after?.version } });
    expect(after?.roll.frames.map((f) => f.id)).toEqual([kept]);
    expect(await holding.list(ctx)).toEqual([
      {
        kind: 'frame',
        rollId: roll.id,
        roll: roll.roll,
        frame,
        at: new Date('2026-11-02T12:00:00.000Z'),
      },
    ]);
  });

  test('refuses when the roll changed since it was read, holding nothing', async () => {
    const { holding, roll, frameId, deleteFrame, createFrame } =
      await withTwoFrames();
    const stale = 'stale';
    await aFrameIn(createFrame, roll.id);

    expect(
      await deleteFrame.execute(ctx, {
        rollId: roll.id,
        frameId,
        expectedVersion: stale,
      }),
    ).toMatchObject({ ok: false, error: { kind: 'concurrency-conflict' } });
    expect(await holding.list(ctx)).toEqual([]);
  });

  test('says when the roll or the frame does not exist', async () => {
    const { roll, version, deleteFrame } = await withTwoFrames();
    const nowhere = checked(missing, isFrameId);

    expect(
      await deleteFrame.execute(ctx, {
        rollId: checked(missing, isRollId),
        frameId: nowhere,
        expectedVersion: version,
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'not-found', entity: 'roll' },
    });
    expect(
      await deleteFrame.execute(ctx, {
        rollId: roll.id,
        frameId: nowhere,
        expectedVersion: version,
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'not-found', entity: 'frame' },
    });
  });
});

describe('DeleteFrames', () => {
  async function withThreeFrames() {
    const setup = await setUp();
    const ids = [
      await aFrameIn(setup.createFrame, setup.roll.id),
      await aFrameIn(setup.createFrame, setup.roll.id),
      await aFrameIn(setup.createFrame, setup.roll.id),
    ];
    const read = await setup.rolls.get(ctx, setup.roll.id);
    return { ...setup, ids, version: read?.version ?? '' };
  }

  test('takes the frames out of the roll in one save, holding each', async () => {
    const { rolls, holding, roll, ids, version, deleteFrames } =
      await withThreeFrames();

    const deleted = await deleteFrames.execute(ctx, {
      rollId: roll.id,
      frameIds: [ids[0] ?? '', ids[2] ?? ''],
      expectedVersion: version,
    });

    const after = await rolls.get(ctx, roll.id);
    expect(deleted).toEqual({ ok: true, value: { version: after?.version } });
    expect(after?.roll.frames.map((frame) => frame.id)).toEqual([ids[1]]);
    expect(
      (await holding.list(ctx)).map((held) =>
        held.kind === 'frame' ? held.frame.id : held.kind,
      ),
    ).toEqual([ids[0], ids[2]]);
  });

  test('says when a frame isn’t in the roll, deleting nothing', async () => {
    const { rolls, holding, roll, ids, version, deleteFrames } =
      await withThreeFrames();

    expect(
      await deleteFrames.execute(ctx, {
        rollId: roll.id,
        frameIds: [ids[0] ?? '', missing],
        expectedVersion: version,
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'frame', id: missing },
    });
    expect((await rolls.get(ctx, roll.id))?.roll.frames).toHaveLength(3);
    expect(await holding.list(ctx)).toEqual([]);
  });

  test('refuses when the roll changed since it was read, holding nothing', async () => {
    const { holding, roll, ids, version, createFrame, deleteFrames } =
      await withThreeFrames();
    await createFrame.execute(ctx, { rollId: roll.id });

    expect(
      await deleteFrames.execute(ctx, {
        rollId: roll.id,
        frameIds: ids,
        expectedVersion: version,
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'concurrency-conflict', entity: 'roll', id: roll.id },
    });
    expect(await holding.list(ctx)).toEqual([]);
  });
});

describe('DeleteVersion', () => {
  async function withTwoVersions() {
    const setup = await setUp();
    const frameId = await aFrameIn(setup.createFrame, setup.roll.id);
    const ids: string[] = [];
    for (const shade of [40, 200]) {
      const added = await setup.addVersion.execute(ctx, {
        rollId: setup.roll.id,
        frameId,
        fileName: `scan-${String(shade)}.jpg`,
        bytes: new Uint8Array(await aJpeg({ shade })),
      });
      if (!added.ok) {
        throw new Error('setup failed');
      }
      ids.push(added.value.id);
    }
    const read = await setup.rolls.get(ctx, setup.roll.id);
    return { ...setup, frameId, ids, version: read?.version ?? '' };
  }

  test('takes the version out of its frame and holds it, keeping the others', async () => {
    const { rolls, holding, roll, frameId, ids, version, deleteVersion } =
      await withTwoVersions();

    const deleted = await deleteVersion.execute(ctx, {
      rollId: roll.id,
      frameId,
      versionId: checked(ids[0] ?? '', isVersionId),
      expectedVersion: version,
    });

    const after = await rolls.get(ctx, roll.id);
    expect(deleted).toEqual({ ok: true, value: { version: after?.version } });
    expect(after?.roll.frames[0]?.versions.map((v) => v.id)).toEqual([ids[1]]);
    expect(await holding.list(ctx)).toMatchObject([
      {
        kind: 'version',
        rollId: roll.id,
        frameId,
        version: { id: ids[0] },
        at: new Date('2026-11-02T12:00:00.000Z'),
      },
    ]);
  });

  test('forgets it as the frame’s chosen version, so its first is shown', async () => {
    const { rolls, roll, frameId, ids, version, updateFrame, deleteVersion } =
      await withTwoVersions();
    const chosen = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
      defaultVersion: ids[1] ?? '',
    });

    await deleteVersion.execute(ctx, {
      rollId: roll.id,
      frameId,
      versionId: checked(ids[1] ?? '', isVersionId),
      expectedVersion: chosen.ok ? chosen.value.version : '',
    });

    expect(
      (await rolls.get(ctx, roll.id))?.roll.frames[0]?.defaultVersion,
    ).toBeNull();
  });

  test('refuses to delete a frame’s only version, holding nothing', async () => {
    const { holding, roll, frameId, ids, version, deleteVersion } =
      await withTwoVersions();
    const first = await deleteVersion.execute(ctx, {
      rollId: roll.id,
      frameId,
      versionId: checked(ids[0] ?? '', isVersionId),
      expectedVersion: version,
    });

    expect(
      await deleteVersion.execute(ctx, {
        rollId: roll.id,
        frameId,
        versionId: checked(ids[1] ?? '', isVersionId),
        expectedVersion: first.ok ? first.value.version : '',
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['versionId'] }] },
    });
    expect(await holding.list(ctx)).toHaveLength(1);
  });

  test('refuses when the roll changed since it was read, holding nothing', async () => {
    const { holding, roll, frameId, ids, version, createFrame, deleteVersion } =
      await withTwoVersions();
    await createFrame.execute(ctx, { rollId: roll.id });

    expect(
      await deleteVersion.execute(ctx, {
        rollId: roll.id,
        frameId,
        versionId: checked(ids[0] ?? '', isVersionId),
        expectedVersion: version,
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'concurrency-conflict', entity: 'roll', id: roll.id },
    });
    expect(await holding.list(ctx)).toEqual([]);
  });

  test('says when the version isn’t the frame’s', async () => {
    const { roll, frameId, version, deleteVersion } = await withTwoVersions();

    expect(
      await deleteVersion.execute(ctx, {
        rollId: roll.id,
        frameId,
        versionId: checked(missing, isVersionId),
        expectedVersion: version,
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'version', id: missing },
    });
  });
});

describe('UpdateFrame with the version shown', () => {
  async function withTwoVersions() {
    const setup = await setUp();
    const frameId = await aFrameIn(setup.createFrame, setup.roll.id);
    const versions: string[] = [];
    for (const shade of [0, 120]) {
      const added = await setup.addVersion.execute(ctx, {
        rollId: setup.roll.id,
        frameId,
        fileName: `1234000${String(shade)}.jpg`,
        bytes: new Uint8Array(await aJpeg({ shade })),
      });
      if (added.ok) {
        versions.push(added.value.id);
      }
    }
    const read = await setup.rolls.get(ctx, setup.roll.id);
    return { ...setup, frameId, versions, version: read?.version ?? '' };
  }

  test('chooses one of the frame’s versions to show, leaving its number', async () => {
    const { roll, frameId, versions, version, updateFrame } =
      await withTwoVersions();

    const updated = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
      defaultVersion: versions[0],
    });

    expect(updated).toMatchObject({
      ok: true,
      value: { frame: { defaultVersion: versions[0], number: null } },
    });
  });

  test('goes back to showing the newest with null', async () => {
    const { rolls, roll, frameId, versions, version, updateFrame } =
      await withTwoVersions();
    const chosen = await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: version,
      defaultVersion: versions[0],
    });

    await updateFrame.execute(ctx, {
      rollId: roll.id,
      frameId,
      expectedVersion: chosen.ok ? chosen.value.version : '',
      defaultVersion: null,
    });

    expect(
      (await rolls.get(ctx, roll.id))?.roll.frames[0]?.defaultVersion,
    ).toBeNull();
  });

  test('refuses a version that is not the frame’s', async () => {
    const { roll, frameId, version, updateFrame } = await withTwoVersions();

    expect(
      await updateFrame.execute(ctx, {
        rollId: roll.id,
        frameId,
        expectedVersion: version,
        defaultVersion: missing,
      }),
    ).toMatchObject({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [{ path: ['defaultVersion'] }],
      },
    });
  });
});

describe('UpdateFrameNumbers', () => {
  async function withFrames(count: number) {
    const setup = await setUp();
    const frameIds: FrameId[] = [];
    for (let i = 0; i < count; i += 1) {
      frameIds.push(await aFrameIn(setup.createFrame, setup.roll.id));
    }
    const read = await setup.rolls.get(ctx, setup.roll.id);
    return { ...setup, frameIds, version: read?.version ?? '' };
  }

  test('sets every frame’s number in one save, and gives the roll as saved', async () => {
    const { rolls, roll, frameIds, version, updateFrameNumbers } =
      await withFrames(3);

    const updated = await updateFrameNumbers.execute(ctx, {
      rollId: roll.id,
      expectedVersion: version,
      numbers: frameIds.map((frameId, i) => ({
        frameId,
        number: String(3 - i),
      })),
    });

    const after = await rolls.get(ctx, roll.id);
    expect(updated).toEqual({ ok: true, value: after });
    expect(after?.roll.frames.map((f) => f.number)).toEqual(['3', '2', '1']);
    expect(Number(after?.version)).toBe(Number(version) + 1);
  });

  test('leaves frames it isn’t given alone, and can clear numbers', async () => {
    const { rolls, roll, frameIds, version, updateFrameNumbers } =
      await withFrames(2);
    const [first, second] = frameIds;
    if (first === undefined || second === undefined) {
      throw new Error('setup failed');
    }
    await updateFrameNumbers.execute(ctx, {
      rollId: roll.id,
      expectedVersion: version,
      numbers: [
        { frameId: first, number: '7' },
        { frameId: second, number: '8' },
      ],
    });
    const read = await rolls.get(ctx, roll.id);

    await updateFrameNumbers.execute(ctx, {
      rollId: roll.id,
      expectedVersion: read?.version ?? '',
      numbers: [{ frameId: second, number: null }],
    });

    expect(
      (await rolls.get(ctx, roll.id))?.roll.frames.map((f) => f.number),
    ).toEqual(['7', null]);
  });

  test('saves nothing if any number is invalid, saying which', async () => {
    const { rolls, roll, frameIds, version, updateFrameNumbers } =
      await withFrames(2);

    const updated = await updateFrameNumbers.execute(ctx, {
      rollId: roll.id,
      expectedVersion: version,
      numbers: frameIds.map((frameId, i) => ({
        frameId,
        number: i === 1 ? '1234567890' : '1',
      })),
    });

    expect(updated).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [
          {
            path: ['numbers', 1, 'number'],
            message: 'must be 1 to 9 characters, like 23 or 12A',
          },
        ],
      },
    });
    expect((await rolls.get(ctx, roll.id))?.version).toBe(version);
  });

  test('refuses when the roll changed since it was read', async () => {
    const { roll, frameIds, version, createFrame, updateFrameNumbers } =
      await withFrames(1);
    await createFrame.execute(ctx, { rollId: roll.id });

    expect(
      await updateFrameNumbers.execute(ctx, {
        rollId: roll.id,
        expectedVersion: version,
        numbers: frameIds.map((frameId) => ({ frameId, number: '1' })),
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'concurrency-conflict', entity: 'roll', id: roll.id },
    });
  });

  test('says when a frame is not in the roll, saving nothing', async () => {
    const { rolls, roll, version, updateFrameNumbers } = await withFrames(1);

    expect(
      await updateFrameNumbers.execute(ctx, {
        rollId: roll.id,
        expectedVersion: version,
        numbers: [{ frameId: checked(missing, isFrameId), number: '1' }],
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'frame', id: missing },
    });
    expect((await rolls.get(ctx, roll.id))?.version).toBe(version);
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
      file: 'frames/unnumbered-00000002/scan-00000003/12340014.jpg',
      sha256: createHash('sha256').update(scan).digest('hex'),
      bytes: scan.length,
      width: 30,
      height: 20,
      added: new Date('2026-11-02T12:00:00.000Z'),
      rotate: 0,
      kind: 'scan',
    };
    expect(added).toEqual({ ok: true, value: version });
    expect((await rolls.get(ctx, roll.id))?.roll.frames[0]?.versions).toEqual([
      version,
    ]);
  });

  test('records the kind of version it was added as (D48)', async () => {
    const { roll, createFrame, addVersion } = await setUp();
    const frameId = await aFrameIn(createFrame, roll.id);

    const added = await addVersion.execute(ctx, {
      rollId: roll.id,
      frameId,
      fileName: 'edit.jpg',
      bytes: new Uint8Array(await aJpeg()),
      kind: 'final',
    });

    expect(added).toMatchObject({ ok: true, value: { kind: 'final' } });
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
      error: { kind: 'image-rejected', reason: 'unsupported-type' },
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

describe('UpdateVersion', () => {
  async function withAVersion() {
    const setup = await setUp();
    const frameId = await aFrameIn(setup.createFrame, setup.roll.id);
    const added = await setup.addVersion.execute(ctx, {
      rollId: setup.roll.id,
      frameId,
      fileName: '12340014.jpg',
      bytes: new Uint8Array(await aJpeg()),
    });
    const read = await setup.rolls.get(ctx, setup.roll.id);
    if (!added.ok || read === undefined) {
      throw new Error('setup failed');
    }
    return {
      ...setup,
      ids: { rollId: setup.roll.id, frameId, versionId: added.value.id },
      added: added.value,
      version: read.version,
    };
  }

  test('turns the version, keeping its file, and gives the roll’s new version', async () => {
    const { rolls, ids, added, version, updateVersion } = await withAVersion();

    const turned = await updateVersion.execute(ctx, {
      ...ids,
      expectedVersion: version,
      rotate: 270,
    });

    const after = await rolls.get(ctx, ids.rollId);
    expect(turned).toMatchObject({
      ok: true,
      value: {
        version: after?.version,
        updated: { id: ids.versionId, rotate: 270 },
      },
    });
    expect(after?.roll.frames[0]?.versions[0]).toEqual({
      ...added,
      rotate: 270,
    });
  });

  test('changes what kind the version is, leaving its turn', async () => {
    const { rolls, ids, version, updateVersion } = await withAVersion();

    const changed = await updateVersion.execute(ctx, {
      ...ids,
      expectedVersion: version,
      kind: 'raw-scan',
    });

    expect(changed).toMatchObject({
      ok: true,
      value: { updated: { kind: 'raw-scan', rotate: 0 } },
    });
    expect(
      (await rolls.get(ctx, ids.rollId))?.roll.frames[0]?.versions[0]?.kind,
    ).toBe('raw-scan');
  });

  test('refuses a kind it doesn’t know', async () => {
    const { ids, version, updateVersion } = await withAVersion();

    expect(
      await updateVersion.execute(ctx, {
        ...ids,
        expectedVersion: version,
        kind: 'negative',
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['kind'] }] },
    });
  });

  test.each([45, -90, 360])('refuses a turn of %d°', async (rotate) => {
    const { ids, version, updateVersion } = await withAVersion();

    expect(
      await updateVersion.execute(ctx, {
        ...ids,
        expectedVersion: version,
        rotate,
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['rotate'] }] },
    });
  });

  test('refuses when the roll changed since it was read', async () => {
    const { ids, version, createFrame, updateVersion } = await withAVersion();
    await createFrame.execute(ctx, { rollId: ids.rollId });

    expect(
      await updateVersion.execute(ctx, {
        ...ids,
        expectedVersion: version,
        rotate: 90,
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'concurrency-conflict', entity: 'roll', id: ids.rollId },
    });
  });

  test('says when the version does not exist', async () => {
    const { ids, version, updateVersion } = await withAVersion();

    expect(
      await updateVersion.execute(ctx, {
        ...ids,
        versionId: checked(missing, isVersionId),
        expectedVersion: version,
        rotate: 90,
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'version', id: missing },
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

    const first = await getThumbnail.execute(ctx, {
      ...ids,
      size: 'small',
      rotate: 0,
    });
    const second = await getThumbnail.execute(ctx, {
      ...ids,
      size: 'small',
      rotate: 0,
    });

    expect(first).toEqual(second);
    expect(first.ok && new TextDecoder().decode(first.value)).toMatch(
      /^small of /,
    );
    expect(previews.originalsLoaded).toBe(1);
  });

  test('GetThumbnail turns it as asked', async () => {
    const { getThumbnail, ids } = await withAVersion();

    const turned = await getThumbnail.execute(ctx, {
      ...ids,
      size: 'small',
      rotate: 90,
    });

    expect(turned.ok && new TextDecoder().decode(turned.value)).toMatch(
      / turned 90$/,
    );
  });

  test.each(['GetOriginal', 'GetThumbnail'])(
    '%s says when the version does not exist',
    async (useCase) => {
      const { getOriginal, getThumbnail, ids } = await withAVersion();
      const absent = { ...ids, versionId: checked(missing, isVersionId) };

      const result =
        useCase === 'GetOriginal'
          ? await getOriginal.execute(ctx, absent)
          : await getThumbnail.execute(ctx, {
              ...absent,
              size: 'small',
              rotate: 0,
            });

      expect(result).toEqual({
        ok: false,
        error: { kind: 'not-found', entity: 'version', id: missing },
      });
    },
  );
});
