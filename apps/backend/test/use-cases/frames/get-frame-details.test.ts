import { describe, expect, test } from 'vitest';
import { InMemoryArchiveRepository } from '../../../src/adapters/outbound/memory/in-memory-archive-repository.ts';
import { InMemoryRollRepository } from '../../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { GetFrameDetails } from '../../../src/application/use-cases/frames/get-frame-details.ts';
import { isFrameId } from '../../../src/domain/shared/ids.ts';
import {
  aCamera,
  aFrame,
  anArchive,
  aRoll,
  ctx,
} from '../../support/builders.ts';
import { checked } from '../../support/checked.ts';

const missing = checked('01JC8Z7K3M0000000000000000', isFrameId);

async function setUp(withArchive = true) {
  const rolls = new InMemoryRollRepository();
  const archives = new InMemoryArchiveRepository();
  const roll = {
    ...aRoll({ frames: [aFrame()] }),
    camera: aCamera('Nikon', 'FE').slug,
  };
  await rolls.create(ctx, roll);
  if (withArchive) {
    await archives.create(
      ctx,
      anArchive('Ben Pirt', { copyright: '© Ben Pirt' }),
    );
  }
  return { roll, getDetails: new GetFrameDetails(rolls, archives) };
}

describe('GetFrameDetails', () => {
  test('gives the frame’s details from the archive and its roll, with where each came from', async () => {
    const { roll, getDetails } = await setUp();
    const frame = roll.frames[0];

    const details = await getDetails.execute(ctx, {
      rollId: roll.id,
      frameId: frame?.id ?? missing,
    });

    const archive = { layer: 'archive', id: anArchive().id };
    expect(details).toEqual({
      ok: true,
      value: {
        author: { value: 'Ben Pirt', source: archive },
        copyright: { value: '© Ben Pirt', source: archive },
        camera: { value: 'nikon-fe', source: { layer: 'roll', id: roll.id } },
      },
    });
  });

  test('a frame’s own details win over its roll’s', async () => {
    const rolls = new InMemoryRollRepository();
    const leica = aCamera('Leica', 'M6').slug;
    const frame = { ...aFrame(), camera: leica };
    const roll = {
      ...aRoll({ frames: [frame] }),
      camera: aCamera('Nikon', 'FE').slug,
    };
    await rolls.create(ctx, roll);

    const details = await new GetFrameDetails(
      rolls,
      new InMemoryArchiveRepository(),
    ).execute(ctx, { rollId: roll.id, frameId: frame.id });

    expect(details).toEqual({
      ok: true,
      value: {
        camera: { value: leica, source: { layer: 'frame', id: frame.id } },
      },
    });
  });

  test('gives only the roll’s when the archive isn’t set up', async () => {
    const { roll, getDetails } = await setUp(false);

    const details = await getDetails.execute(ctx, {
      rollId: roll.id,
      frameId: roll.frames[0]?.id ?? missing,
    });

    expect(details.ok && details.value.author).toBeUndefined();
  });

  test('says when the frame isn’t in the roll', async () => {
    const { roll, getDetails } = await setUp();

    expect(
      await getDetails.execute(ctx, { rollId: roll.id, frameId: missing }),
    ).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'frame', id: missing },
    });
  });
});
