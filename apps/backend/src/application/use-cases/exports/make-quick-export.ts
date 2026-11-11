import {
  archiveLayer,
  frameLayer,
  rollLayer,
} from '../../../domain/details/layers.ts';
import { resolveDetails } from '../../../domain/details/resolve-details.ts';
import type { Frame, Roll } from '../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { BlobStore } from '../../ports/blob-store.ts';
import type { Clock } from '../../ports/clock.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';
import type { EventRepository } from '../../ports/event-repository.ts';
import type { ExportTickets, QuickExport } from '../../ports/export-tickets.ts';
import type { ImageRenderer } from '../../ports/image-renderer.ts';
import type { RollRepository } from '../../ports/roll-repository.ts';
import type { SettingsRepository } from '../../ports/settings-repository.ts';
import { FilePaths, fileNameOf, safeName } from './export-names.ts';
import { exportMetadata } from './export-metadata.ts';
import { zipOf, type ZipEntry } from './zip.ts';

/** A made export, ready to send as a download. */
export type MadeExport =
  | {
      readonly kind: 'jpeg';
      readonly fileName: string;
      readonly jpeg: Uint8Array;
    }
  | {
      readonly kind: 'zip';
      readonly fileName: string;
      /** The zip, in pieces as they're made: stopping reading stops the work. */
      readonly parts: AsyncIterable<Uint8Array>;
    };

/** A frame made into a JPEG, with what its file name and place are made from. */
interface MadeFrame {
  readonly jpeg: Uint8Array;
  readonly roll: Roll;
  readonly frame: Frame;
  readonly original: string;
  readonly year: string;
}

/** Why a frame wasn't made, for the list of those left out. */
class LeftOut extends Error {}

/**
 * Makes what a ticket is for (D95): each frame from the version shown,
 * turned as it's shown, at the recipe's size and quality, carrying what the
 * recipe says it should about the frame. One frame is a JPEG; any number are
 * a zip, laid out and named as chosen, sent as it's made, with a
 * `skipped.txt` for the frames that couldn't be made. The ticket works once;
 * nothing is written to disk.
 */
export class MakeQuickExport {
  readonly #rolls: RollRepository;
  readonly #settings: SettingsRepository;
  readonly #equipment: EquipmentRepository;
  readonly #events: EventRepository;
  readonly #blobs: BlobStore;
  readonly #tickets: ExportTickets;
  readonly #renderer: ImageRenderer;
  readonly #clock: Clock;

  constructor(
    rolls: RollRepository,
    settings: SettingsRepository,
    equipment: EquipmentRepository,
    events: EventRepository,
    blobs: BlobStore,
    tickets: ExportTickets,
    renderer: ImageRenderer,
    clock: Clock,
  ) {
    this.#rolls = rolls;
    this.#settings = settings;
    this.#equipment = equipment;
    this.#events = events;
    this.#blobs = blobs;
    this.#tickets = tickets;
    this.#renderer = renderer;
    this.#clock = clock;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly ticket: string },
  ): Promise<Result<MadeExport, NotFound>> {
    const quick = this.#tickets.redeem(input.ticket);
    if (quick === undefined) {
      return err({ kind: 'not-found', entity: 'export', id: input.ticket });
    }
    if (quick.output === 'zip') {
      return ok({
        kind: 'zip',
        fileName: `${await this.#zipName(ctx, quick)}.zip`,
        parts: zipOf(this.entries(ctx, quick), this.#clock.now()),
      });
    }
    const [wanted] = quick.frames;
    if (wanted === undefined) {
      return err({ kind: 'not-found', entity: 'frame', id: '' });
    }
    try {
      const made = await this.#make(ctx, wanted.rollId, wanted.frameId, quick);
      return ok({
        kind: 'jpeg',
        fileName: `${this.#nameOf(quick, made)}.jpg`,
        jpeg: made.jpeg,
      });
    } catch (error) {
      if (error instanceof LeftOut) {
        return err({ kind: 'not-found', entity: 'frame', id: wanted.frameId });
      }
      throw error;
    }
  }

  #nameOf(quick: QuickExport, made: MadeFrame): string {
    return fileNameOf(quick.naming.pattern, this.#partsOf(made));
  }

  #partsOf(made: MadeFrame) {
    return {
      roll: made.roll.roll,
      frame: made.frame.number ?? 'frame',
      title: made.frame.title ?? '',
      year: made.year,
      original: made.original,
    };
  }

  /** The zip's name: the one asked for, else the roll's number and what it's of, e.g. "2026-014 Westfjords"; for several rolls, "FilmFile export". */
  async #zipName(ctx: ArchiveContext, quick: QuickExport): Promise<string> {
    const given = safeName(quick.name ?? '');
    if (given !== '') {
      return given;
    }
    const rollIds = new Set(quick.frames.map((frame) => frame.rollId));
    const [only] = [...rollIds];
    const roll =
      rollIds.size === 1 && only !== undefined
        ? (await this.#rolls.get(ctx, only))?.roll
        : undefined;
    if (roll === undefined) {
      return 'FilmFile export';
    }
    const event =
      roll.event === null
        ? undefined
        : (await this.#events.get(ctx, roll.event))?.event.name;
    return safeName([roll.roll, event ?? roll.name].filter(Boolean).join(' '));
  }

  /** Each frame's JPEG as it's made, then a list of those left out (a `skipped.txt`). */
  async *entries(
    ctx: ArchiveContext,
    quick: QuickExport,
  ): AsyncGenerator<ZipEntry> {
    const paths = new FilePaths(quick.naming.layout, quick.naming.pattern);
    const leftOut: string[] = [];
    for (const { rollId, frameId } of quick.frames) {
      try {
        const made = await this.#make(ctx, rollId, frameId, quick);
        yield { name: paths.next(this.#partsOf(made)), data: made.jpeg };
      } catch (error) {
        // A frame that can't be made is left out and said so, rather than
        // stopping a zip that's already being downloaded.
        const reason =
          error instanceof LeftOut
            ? error.message
            : "its image couldn't be made";
        leftOut.push(
          `${await this.#describe(ctx, rollId, frameId)}: ${reason}`,
        );
      }
    }
    if (leftOut.length > 0) {
      yield {
        name: 'skipped.txt',
        data: new TextEncoder().encode(
          `These frames were left out:\n${leftOut.map((line) => `- ${line}`).join('\n')}\n`,
        ),
      };
    }
  }

  async #describe(
    ctx: ArchiveContext,
    rollId: QuickExport['frames'][number]['rollId'],
    frameId: QuickExport['frames'][number]['frameId'],
  ): Promise<string> {
    const roll = (await this.#rolls.get(ctx, rollId))?.roll;
    const frame = roll?.frames.find((f) => f.id === frameId);
    return frame === undefined || roll === undefined
      ? `frame ${frameId}`
      : `frame ${frame.number ?? 'with no number'} of roll ${roll.roll}`;
  }

  /** One frame made as a JPEG, or a `LeftOut` saying why it can't be. */
  async #make(
    ctx: ArchiveContext,
    rollId: QuickExport['frames'][number]['rollId'],
    frameId: QuickExport['frames'][number]['frameId'],
    quick: QuickExport,
  ): Promise<MadeFrame> {
    const roll = (await this.#rolls.get(ctx, rollId))?.roll;
    const frame = roll?.frames.find((f) => f.id === frameId);
    if (roll === undefined || frame === undefined) {
      throw new LeftOut('it is no longer there');
    }
    if (frame.hidden) {
      throw new LeftOut('it is hidden');
    }
    const version =
      frame.versions.find((v) => v.id === frame.defaultVersion) ??
      frame.versions[0];
    if (version === undefined) {
      throw new LeftOut('it has no scan');
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
    return {
      jpeg,
      roll,
      frame,
      // The scan's own name, without its folders or extension.
      original: (version.file.split('/').at(-1) ?? '').replace(/\.[^.]*$/, ''),
      year: details.shot?.value.slice(0, 4) ?? 'undated',
    };
  }
}
