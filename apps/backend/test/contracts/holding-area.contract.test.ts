import { FilesystemHoldingArea } from '../../src/adapters/outbound/filesystem/filesystem-holding-area.ts';
import { FilesystemRollRepository } from '../../src/adapters/outbound/filesystem/filesystem-roll-repository.ts';
import { InMemoryHoldingArea } from '../../src/adapters/outbound/memory/in-memory-holding-area.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { ctx } from '../support/builders.ts';
import { holdingAreaContract } from './holding-area-contract.ts';

const archive = useTempArchive();

holdingAreaContract('InMemoryHoldingArea', () => new InMemoryHoldingArea());

holdingAreaContract(
  'FilesystemHoldingArea',
  () => new FilesystemHoldingArea(archive.path()),
  async (roll) => {
    await new FilesystemRollRepository(archive.path()).create(ctx, roll);
  },
);
