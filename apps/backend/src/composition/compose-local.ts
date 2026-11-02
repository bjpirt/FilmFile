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
import { AddVersion } from '../application/use-cases/frames/add-version.ts';
import { CreateFrame } from '../application/use-cases/frames/create-frame.ts';
import { GetOriginal } from '../application/use-cases/frames/get-original.ts';
import { GetThumbnail } from '../application/use-cases/frames/get-thumbnail.ts';
import { CreateRoll } from '../application/use-cases/rolls/create-roll.ts';
import { GetRoll } from '../application/use-cases/rolls/get-roll.ts';
import { ListRolls } from '../application/use-cases/rolls/list-rolls.ts';
import type { ArchiveContext } from '../domain/shared/archive-context.ts';
import { isArchiveId } from '../domain/shared/ids.ts';

// The archive has no ID of its own until archive.json is created when it's
// set up (task 1.3.1), so every request acts on this one.
// Images are decoded only up to this size, so a small file claiming huge
// dimensions (a decompression bomb) can't exhaust memory.
const maxPixels = 100_000_000;

function localArchive(): ArchiveContext {
  const archiveId = '00000000000000000000000000';
  if (!isArchiveId(archiveId)) {
    throw new Error(`${archiveId} is not a ULID`);
  }
  return { archiveId };
}

/** Wires the service for running on this machine. */
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
  const clock = config.clock ?? new NodeClock();
  const ids = config.ids ?? new UlidGenerator();
  const rolls = new FilesystemRollRepository(config.archivePath);
  const blobs = new FilesystemBlobStore(config.archivePath);
  const inspector = new SharpImageInspector(maxPixels);
  const previews = new SharpPreviewProvider(config.cachePath, maxPixels);

  return createApp({
    ...config,
    ctx: localArchive(),
    useCases: {
      createRoll: new CreateRoll(rolls, ids),
      getRoll: new GetRoll(rolls),
      listRolls: new ListRolls(rolls),
      createFrame: new CreateFrame(rolls, ids),
      addVersion: new AddVersion(rolls, blobs, inspector, ids, clock),
      getOriginal: new GetOriginal(rolls, blobs),
      getThumbnail: new GetThumbnail(rolls, blobs, previews),
    },
  });
}
