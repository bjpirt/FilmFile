import { FilesystemEventRepository } from '../../src/adapters/outbound/filesystem/filesystem-event-repository.ts';
import { InMemoryEventRepository } from '../../src/adapters/outbound/memory/in-memory-event-repository.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { eventRepositoryContract } from './event-repository-contract.ts';

const archive = useTempArchive();

eventRepositoryContract(
  'InMemoryEventRepository',
  () => new InMemoryEventRepository(),
);

eventRepositoryContract(
  'FilesystemEventRepository',
  () => new FilesystemEventRepository(archive.path()),
);
