import { InMemoryRollRepository } from '../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { rename } from 'node:fs/promises';
import path from 'node:path';
import {
  FilesystemRollRepository,
  rollFolder,
} from '../../src/adapters/outbound/filesystem/filesystem-roll-repository.ts';
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
  (roll) =>
    rename(
      rollFolder(archive.path(), roll.roll),
      path.join(archive.path(), `taken-${roll.id}`),
    ),
);
