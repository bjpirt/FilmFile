import { homedir, hostname } from 'node:os';
import path from 'node:path';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { createApp } from '../adapters/inbound/http/create-app.ts';
import type { ReportError } from '../adapters/inbound/http/middleware/error-handler.ts';
import { FilesystemSettingsRepository } from '../adapters/outbound/filesystem/filesystem-settings-repository.ts';
import { FilesystemEquipmentRepository } from '../adapters/outbound/filesystem/filesystem-equipment-repository.ts';
import { FilesystemEventRepository } from '../adapters/outbound/filesystem/filesystem-event-repository.ts';
import { FilesystemHoldingArea } from '../adapters/outbound/filesystem/filesystem-holding-area.ts';
import { FilesystemBlobStore } from '../adapters/outbound/filesystem/filesystem-blob-store.ts';
import { FilesystemSiteFolders } from '../adapters/outbound/filesystem/filesystem-site-folders.ts';
import { FilesystemSiteRepository } from '../adapters/outbound/filesystem/filesystem-site-repository.ts';
import { FilesystemRollRepository } from '../adapters/outbound/filesystem/filesystem-roll-repository.ts';
import { InMemoryExportTickets } from '../adapters/outbound/memory/in-memory-export-tickets.ts';
import { ParentProcessExportDestination } from '../adapters/outbound/node/parent-process-export-destination.ts';
import type { ExportDestination } from '../application/ports/export-destination.ts';
import { ConsoleErrorReporter } from '../adapters/outbound/node/console-error-reporter.ts';
import { NodeClock } from '../adapters/outbound/node/node-clock.ts';
import { UlidGenerator } from '../adapters/outbound/node/ulid-generator.ts';
import { SharpImageInspector } from '../adapters/outbound/sharp/sharp-image-inspector.ts';
import { SharpImageRenderer } from '../adapters/outbound/sharp/sharp-image-renderer.ts';
import { SharpPreviewProvider } from '../adapters/outbound/sharp/sharp-preview-provider.ts';
import { R2PublishBucket } from '../adapters/outbound/r2/r2-publish-bucket.ts';
import type { PublishBucket } from '../application/ports/publish-bucket.ts';
import { FilesystemLibraryFiles } from '../adapters/outbound/filesystem/filesystem-library-files.ts';
import { FileSyncSettings } from '../adapters/outbound/filesystem/file-sync-settings.ts';
import { ParentProcessSyncSettings } from '../adapters/outbound/node/parent-process-sync-settings.ts';
import type { SyncSettingsStore } from '../application/ports/sync-settings-store.ts';
import { computerNameFrom } from '../domain/sync/computer-name.ts';
import type { Clock } from '../application/ports/clock.ts';
import type { ErrorReporter } from '../application/ports/error-reporter.ts';
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
 * failure goes to `errors` (D113), and the requests that need the library say
 * what's wrong with it.
 */
export async function localStartup(
  config: { readonly archivePath: string },
  log: (message: string) => void,
  errors: ErrorReporter = new ConsoleErrorReporter(),
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
  } catch (error) {
    errors.report("Couldn't make originals read-only", error);
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
  /** The AWS credentials file whose `[filmfile]` profile holds the keys that publish a site (D111); by default `~/.aws/credentials`. */
  readonly awsCredentialsFile?: string;
  /** Where R2 is in place of Cloudflare's own address, for testing only (FILMFILE_R2_ENDPOINT). */
  readonly r2Endpoint?: string;
  /** A file of this computer's sync settings, for testing only (FILMFILE_SYNC_SETTINGS); otherwise the desktop app keeps them. */
  readonly syncSettingsFile?: string;
  /** This computer's sync settings, for tests; otherwise from the file or the desktop app. */
  readonly syncSettings?: SyncSettingsStore;
  /** Where sites are published; by default a Cloudflare R2 bucket, with keys from `awsCredentialsFile`. */
  readonly publishBucket?: PublishBucket;
  /** Asks for a folder to export into; by default the desktop app that started the service, if one did (D100). */
  readonly destination?: ExportDestination;
}): OpenAPIHono {
  const clock = config.clock ?? new NodeClock();
  const errors = new ConsoleErrorReporter();
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
      siteFolders: new FilesystemSiteFolders(config.folderPath),
      publishBucket:
        config.publishBucket ??
        new R2PublishBucket({
          credentialsFile:
            config.awsCredentialsFile ??
            path.join(homedir(), '.aws', 'credentials'),
          clock,
          errors,
          ...(config.r2Endpoint === undefined
            ? {}
            : { endpoint: () => config.r2Endpoint ?? '' }),
        }),
      libraryFiles: new FilesystemLibraryFiles(
        config.folderPath,
        config.cachePath,
      ),
      syncSettings:
        config.syncSettings ??
        (config.syncSettingsFile === undefined
          ? ParentProcessSyncSettings.ofThisProcess()
          : new FileSyncSettings(config.syncSettingsFile)),
      thisComputer: computerNameFrom(hostname()),
      tickets: new InMemoryExportTickets(clock),
      destination,
      ids: config.ids ?? new UlidGenerator(),
      errors,
      clock,
    }),
  });
}
