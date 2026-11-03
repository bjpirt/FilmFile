import { FilesystemHoldingArea } from '../../src/adapters/outbound/filesystem/filesystem-holding-area.ts';
import { InMemoryHoldingArea } from '../../src/adapters/outbound/memory/in-memory-holding-area.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { holdingAreaContract } from './holding-area-contract.ts';

const archive = useTempArchive();

holdingAreaContract('InMemoryHoldingArea', () => new InMemoryHoldingArea());

holdingAreaContract(
  'FilesystemHoldingArea',
  () => new FilesystemHoldingArea(archive.path()),
);
