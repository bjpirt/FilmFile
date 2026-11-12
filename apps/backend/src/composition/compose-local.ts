import type { OpenAPIHono } from '@hono/zod-openapi';
import { createApp } from '../adapters/inbound/http/create-app.ts';
import type { ReportError } from '../adapters/inbound/http/middleware/error-handler.ts';
import { FilesystemSettingsRepository } from '../adapters/outbound/filesystem/filesystem-settings-repository.ts';
import { FilesystemEquipmentRepository } from '../adapters/outbound/filesystem/filesystem-equipment-repository.ts';
import { FilesystemEventRepository } from '../adapters/outbound/filesystem/filesystem-event-repository.ts';
import { FilesystemHoldingArea } from '../adapters/outbound/filesystem/filesystem-holding-area.ts';
import { FilesystemBlobStore } from '../adapters/outbound/filesystem/filesystem-blob-store.ts';
import { FilesystemSiteRepository } from '../adapters/outbound/filesystem/filesystem-site-repository.ts';
import { FilesystemRollRepository } from '../adapters/outbound/filesystem/filesystem-roll-repository.ts';
import { InMemoryExportTickets } from '../adapters/outbound/memory/in-memory-export-tickets.ts';
import { ParentProcessExportDestination } from '../adapters/outbound/node/parent-process-export-destination.ts';
import type { ExportDestination } from '../application/ports/export-destination.ts';
import { NodeClock } from '../adapters/outbound/node/node-clock.ts';
import { UlidGenerator } from '../adapters/outbound/node/ulid-generator.ts';
import { SharpImageInspector } from '../adapters/outbound/sharp/sharp-image-inspector.ts';
import { SharpImageRenderer } from '../adapters/outbound/sharp/sharp-image-renderer.ts';
import { SharpPreviewProvider } from '../adapters/outbound/sharp/sharp-preview-provider.ts';
import type { Clock } from '../application/ports/clock.ts';
import type { IdGenerator } from '../application/ports/id-generator.ts';
import { localArchive } from './local-archive.ts';
import { ProtectOriginals } from '../application/use-cases/originals/protect-originals.ts';
import { useCasesFor } from './use-cases-for.ts';

// Images are decoded only up to this size, so a small file claiming huge
// dimensions (a decompression bomb) can't exhaust memory.
export const maxPixels = 100_000_000;

/**
 * What the service does once as it starts, in the background (FF-109): makes
 * the images already in the library read-only. It says what it did through
 * `log`, once, and nothing when there was nothing to do. It never throws: a
 * library it can't read is for the requests that need it to report.
 */
export async function localStartup(
  config: { readonly archivePath: string },
  log: (message: string) => void,
): Promise<void> {
  try {
    const { changed, couldNotChange } = await new ProtectOriginals(
      new FilesystemRollRepository(config.archivePath),
      new FilesystemBlobStore(config.archivePath),
    ).execute(localArchive());
    if (changed > 0 || couldNotChange > 0) {
      const made = `Made ${String(changed)} ${changed === 1 ? 'original' : 'originals'} read-only`;
      log(
        couldNotChange === 0
          ? `${made}.`
          : `${made}; ${String(couldNotChange)} couldn't be changed.`,
      );
    }
  } catch {
    // Nothing to protect, or nothing readable: requests say what's wrong.
  }
}

/** Wires the service for running on this machine: the FilmFile folder on disk (its settings at the top, the archive in its Library), sharp, the system clock. */
export function composeLocal(config: {
  readonly folderPath: string;
  readonly archivePath: string;
  readonly cachePath: string;
  readonly uiPath?: string;
  readonly port: number;
  readonly uiOrigin?: string;
  readonly reportError?: ReportError;
  // Tests pass a fixed clock and sequential IDs.
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  /** Asks for a folder to export into; by default the desktop app that started the service, if one did (D100). */
  readonly destination?: ExportDestination;
}): OpenAPIHono {
  const clock = config.clock ?? new NodeClock();
  const destination =
    config.destination ?? ParentProcessExportDestination.ofThisProcess();
  return createApp({
    ...config,
    exportToFolder: destination !== undefined,
    ctx: localArchive(),
    useCases: useCasesFor({
      settings: new FilesystemSettingsRepository(config.folderPath),
      rolls: new FilesystemRollRepository(config.archivePath),
      equipment: new FilesystemEquipmentRepository(config.archivePath),
      events: new FilesystemEventRepository(config.archivePath),
      blobs: new FilesystemBlobStore(config.archivePath),
      holding: new FilesystemHoldingArea(config.archivePath),
      inspector: new SharpImageInspector(maxPixels),
      previews: new SharpPreviewProvider(config.cachePath, maxPixels),
      renderer: new SharpImageRenderer(maxPixels),
      sites: new FilesystemSiteRepository(config.archivePath),
      tickets: new InMemoryExportTickets(clock),
      destination,
      ids: config.ids ?? new UlidGenerator(),
      clock,
    }),
  });
}
