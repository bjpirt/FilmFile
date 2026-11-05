import { InMemoryRollRepository } from '../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { rename } from 'node:fs/promises';
import path from 'node:path';
import { FilesystemRollRepository } from '../../src/adapters/outbound/filesystem/filesystem-roll-repository.ts';
import { findRollFolder } from '../../src/adapters/outbound/filesystem/roll-folder.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { rollRepositoryContract } from './roll-repository-contract.ts';

const archive = useTempArchive();

rollRepositoryContract(
  'InMemoryRollRepository',
  () => new InMemoryRollRepository(),
);

rollRepositoryContract(
  'FilesystemRollRepository',
  () => new FilesystemRollRepository(archive.path()),
  // The holding area moves the roll's folder out of rolls/.
  async (roll) => {
    const folder = await findRollFolder(archive.path(), roll.id);
    await rename(folder ?? '', path.join(archive.path(), `taken-${roll.id}`));
  },
);
