import { InMemoryImageRenderer } from '../../src/adapters/outbound/memory/in-memory-image-renderer.ts';
import { SharpImageRenderer } from '../../src/adapters/outbound/sharp/sharp-image-renderer.ts';
import { imageRendererContract } from './image-renderer-contract.ts';

imageRendererContract(
  'InMemoryImageRenderer',
  () => new InMemoryImageRenderer(),
);

imageRendererContract(
  'SharpImageRenderer',
  () => new SharpImageRenderer(100_000_000),
);
