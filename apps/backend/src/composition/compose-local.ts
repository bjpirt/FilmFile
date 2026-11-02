import type { OpenAPIHono } from '@hono/zod-openapi';
import { createApp } from '../adapters/inbound/http/create-app.ts';
import type { ReportError } from '../adapters/inbound/http/middleware/error-handler.ts';
import { FilesystemBlobStore } from '../adapters/outbound/filesystem/filesystem-blob-store.ts';
import { FilesystemRollRepository } from '../adapters/outbound/filesystem/filesystem-roll-repository.ts';
import { NodeClock } from '../adapters/outbound/node/node-clock.ts';
import { UlidGenerator } from '../adapters/outbound/node/ulid-generator.ts';
import { SharpImageInspector } from '../adapters/outbound/sharp/sharp-image-inspector.ts';
import { SharpPreviewProvider } from '../adapters/outbound/sharp/sharp-preview-provider.ts';
import type { Clock } from '../application/ports/clock.ts';
import type { IdGenerator } from '../application/ports/id-generator.ts';
import { localArchive } from './local-archive.ts';
import { useCasesFor } from './use-cases-for.ts';

// Images are decoded only up to this size, so a small file claiming huge
// dimensions (a decompression bomb) can't exhaust memory.
export const maxPixels = 100_000_000;

/** Wires the service for running on this machine: the archive on disk, sharp, the system clock. */
export function composeLocal(config: {
  readonly archivePath: string;
  readonly cachePath: string;
  readonly uiPath?: string;
  readonly port: number;
  readonly uiOrigin?: string;
  readonly reportError?: ReportError;
  // Tests pass a fixed clock and sequential IDs.
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
}): OpenAPIHono {
  return createApp({
    ...config,
    ctx: localArchive(),
    useCases: useCasesFor({
      rolls: new FilesystemRollRepository(config.archivePath),
      blobs: new FilesystemBlobStore(config.archivePath),
      inspector: new SharpImageInspector(maxPixels),
      previews: new SharpPreviewProvider(config.cachePath, maxPixels),
      ids: config.ids ?? new UlidGenerator(),
      clock: config.clock ?? new NodeClock(),
    }),
  });
}
