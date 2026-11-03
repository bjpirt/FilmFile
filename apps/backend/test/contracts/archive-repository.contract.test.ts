import { FilesystemArchiveRepository } from '../../src/adapters/outbound/filesystem/filesystem-archive-repository.ts';
import { InMemoryArchiveRepository } from '../../src/adapters/outbound/memory/in-memory-archive-repository.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { archiveRepositoryContract } from './archive-repository-contract.ts';

const archive = useTempArchive();

archiveRepositoryContract(
  'InMemoryArchiveRepository',
  () => new InMemoryArchiveRepository(),
);

archiveRepositoryContract(
  'FilesystemArchiveRepository',
  () => new FilesystemArchiveRepository(archive.path()),
);
