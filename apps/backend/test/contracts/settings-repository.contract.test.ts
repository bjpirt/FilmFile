import { FilesystemSettingsRepository } from '../../src/adapters/outbound/filesystem/filesystem-settings-repository.ts';
import { InMemorySettingsRepository } from '../../src/adapters/outbound/memory/in-memory-settings-repository.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { settingsRepositoryContract } from './settings-repository-contract.ts';

const archive = useTempArchive();

settingsRepositoryContract(
  'InMemorySettingsRepository',
  () => new InMemorySettingsRepository(),
);

settingsRepositoryContract(
  'FilesystemSettingsRepository',
  () => new FilesystemSettingsRepository(archive.folder()),
);
