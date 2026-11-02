import { FilesystemBlobStore } from '../../src/adapters/outbound/filesystem/filesystem-blob-store.ts';
import { InMemoryBlobStore } from '../../src/adapters/outbound/memory/in-memory-blob-store.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { blobStoreContract } from './blob-store-contract.ts';

const archive = useTempArchive();

blobStoreContract('InMemoryBlobStore', () => new InMemoryBlobStore());

blobStoreContract(
  'FilesystemBlobStore',
  () => new FilesystemBlobStore(archive.path()),
);
