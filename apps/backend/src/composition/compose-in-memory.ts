import type { OpenAPIHono } from '@hono/zod-openapi';
import { createApp } from '../adapters/inbound/http/create-app.ts';
import { FixedClock } from '../adapters/outbound/memory/fixed-clock.ts';
import { InMemoryArchiveRepository } from '../adapters/outbound/memory/in-memory-archive-repository.ts';
import { InMemoryBlobStore } from '../adapters/outbound/memory/in-memory-blob-store.ts';
import { InMemoryEquipmentRepository } from '../adapters/outbound/memory/in-memory-equipment-repository.ts';
import { InMemoryEventRepository } from '../adapters/outbound/memory/in-memory-event-repository.ts';
import { InMemoryHoldingArea } from '../adapters/outbound/memory/in-memory-holding-area.ts';
import { InMemoryPreviewProvider } from '../adapters/outbound/memory/in-memory-preview-provider.ts';
import { InMemoryRollRepository } from '../adapters/outbound/memory/in-memory-roll-repository.ts';
import { SequentialIdGenerator } from '../adapters/outbound/memory/sequential-id-generator.ts';
import { SharpImageInspector } from '../adapters/outbound/sharp/sharp-image-inspector.ts';
import { maxPixels } from './compose-local.ts';
import { localArchive } from './local-archive.ts';
import { useCasesFor, type Adapters } from './use-cases-for.ts';

/**
 * The service with nothing on disk: rolls and files in memory, a fixed
 * clock at 2026-11-02T12:00:00Z and IDs counting up from …0001, on port 4310.
 * For tests; `overrides` swaps in other adapters. Images are still
 * inspected with sharp, which needs no disk.
 */
export function composeInMemory(
  overrides: Partial<Adapters> = {},
): OpenAPIHono {
  return createApp({
    port: 4310,
    ctx: localArchive(),
    useCases: useCasesFor({
      archives: new InMemoryArchiveRepository(),
      rolls: new InMemoryRollRepository(),
      equipment: new InMemoryEquipmentRepository(),
      events: new InMemoryEventRepository(),
      blobs: new InMemoryBlobStore(),
      holding: new InMemoryHoldingArea(),
      inspector: new SharpImageInspector(maxPixels),
      previews: new InMemoryPreviewProvider(),
      ids: new SequentialIdGenerator(),
      clock: new FixedClock('2026-11-02T12:00:00.000Z'),
      ...overrides,
    }),
  });
}
