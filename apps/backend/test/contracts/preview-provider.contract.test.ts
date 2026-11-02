import { InMemoryPreviewProvider } from '../../src/adapters/outbound/memory/in-memory-preview-provider.ts';
import { SharpPreviewProvider } from '../../src/adapters/outbound/sharp/sharp-preview-provider.ts';
import { useTempArchive } from '../support/temp-archive.ts';
import { previewProviderContract } from './preview-provider-contract.ts';

const archive = useTempArchive();

previewProviderContract(
  'InMemoryPreviewProvider',
  () => new InMemoryPreviewProvider(),
);

previewProviderContract(
  'SharpPreviewProvider',
  () => new SharpPreviewProvider(archive.cachePath(), 100_000_000),
);
