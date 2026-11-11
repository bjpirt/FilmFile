import {
  archiveLayer,
  frameLayer,
  rollLayer,
} from '../../../domain/details/layers.ts';
import { resolveDetails } from '../../../domain/details/resolve-details.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { BlobStore } from '../../ports/blob-store.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';
import type { EventRepository } from '../../ports/event-repository.ts';
import type { ExportTickets } from '../../ports/export-tickets.ts';
import type { ImageRenderer } from '../../ports/image-renderer.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';
import { exportFileName } from './export-file-name.ts';
import { exportMetadata } from './export-metadata.ts';

/** A made export, ready to send as a download. */
export interface MadeExport {
  readonly fileName: string;
  readonly jpeg: Uint8Array;
}

/**
 * Makes the frame a ticket is for (D95): from the version shown, turned as
 * it's shown, at the recipe's size and quality, carrying what the recipe says
 * it should about the frame. The ticket works once; nothing is written to disk.
 */
export class MakeQuickExport {
  readonly #rolls: RollRepository;
  readonly #settings: SettingsRepository;
  readonly #equipment: EquipmentRepository;
  readonly #events: EventRepository;
  readonly #blobs: BlobStore;
  readonly #tickets: ExportTickets;
  readonly #renderer: ImageRenderer;

  constructor(
    rolls: RollRepository,
    settings: SettingsRepository,
    equipment: EquipmentRepository,
    events: EventRepository,
    blobs: BlobStore,
    tickets: ExportTickets,
    renderer: ImageRenderer,
  ) {
    this.#rolls = rolls;
    this.#settings = settings;
    this.#equipment = equipment;
    this.#events = events;
    this.#blobs = blobs;
    this.#tickets = tickets;
    this.#renderer = renderer;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly ticket: string },
  ): Promise<Result<MadeExport, NotFound>> {
    const quick = this.#tickets.redeem(input.ticket);
    if (quick === undefined) {
      return err({ kind: 'not-found', entity: 'export', id: input.ticket });
    }
    const roll = (await this.#rolls.get(ctx, quick.rollId))?.roll;
    const frame = roll?.frames.find((f) => f.id === quick.frameId);
    const version =
      frame?.versions.find((v) => v.id === frame.defaultVersion) ??
      frame?.versions[0];
    if (roll === undefined || frame === undefined || version === undefined) {
      return err({ kind: 'not-found', entity: 'frame', id: quick.frameId });
    }
    const settings = (await this.#settings.get(ctx))?.settings;
    const details = resolveDetails([
      ...(settings === undefined ? [] : [archiveLayer(settings)]),
      rollLayer(roll),
      frameLayer(frame),
    ]);
    const jpeg = await this.#renderer.render(
      await this.#blobs.get(ctx, roll.id, version.file),
      version.rotate,
      quick.recipe,
      exportMetadata({
        choice: quick.recipe.metadata,
        details,
        roll,
        frame,
        camera:
          details.camera === undefined
            ? undefined
            : await this.#equipment.getCamera(ctx, details.camera.value),
        lens:
          details.lens === undefined
            ? undefined
            : await this.#equipment.getLens(ctx, details.lens.value),
        film:
          details.film === undefined
            ? undefined
            : await this.#equipment.getFilmStock(ctx, details.film.value),
        event:
          details.event === undefined
            ? undefined
            : (await this.#events.get(ctx, details.event.value))?.event,
      }),
    );
    return ok({ fileName: exportFileName(roll, frame), jpeg });
  }
}
