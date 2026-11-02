import { InMemoryRollRepository } from '../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { FilesystemRollRepository } from '../../src/adapters/outbound/filesystem/filesystem-roll-repository.ts';
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
);
