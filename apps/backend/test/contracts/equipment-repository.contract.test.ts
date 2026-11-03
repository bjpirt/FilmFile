import { FilesystemEquipmentRepository } from '../../src/adapters/outbound/filesystem/filesystem-equipment-repository.ts';
import { InMemoryEquipmentRepository } from '../../src/adapters/outbound/memory/in-memory-equipment-repository.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { equipmentRepositoryContract } from './equipment-repository-contract.ts';

const archive = useTempArchive();

equipmentRepositoryContract(
  'InMemoryEquipmentRepository',
  () => new InMemoryEquipmentRepository(),
);

equipmentRepositoryContract(
  'FilesystemEquipmentRepository',
  () => new FilesystemEquipmentRepository(archive.path()),
);
