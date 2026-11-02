import type { RollUseCases } from '../adapters/inbound/http/routes/rolls.ts';
import type { BlobStore } from '../application/ports/blob-store.ts';
import type { Clock } from '../application/ports/clock.ts';
import type { IdGenerator } from '../application/ports/id-generator.ts';
import type { ImageInspector } from '../application/ports/image-inspector.ts';
import type { PreviewProvider } from '../application/ports/preview-provider.ts';
import type { RollRepository } from '../application/ports/roll-repository.ts';
import { AddVersion } from '../application/use-cases/frames/add-version.ts';
import { CreateFrame } from '../application/use-cases/frames/create-frame.ts';
import { GetOriginal } from '../application/use-cases/frames/get-original.ts';
import { GetThumbnail } from '../application/use-cases/frames/get-thumbnail.ts';
import { CreateRoll } from '../application/use-cases/rolls/create-roll.ts';
import { GetRoll } from '../application/use-cases/rolls/get-roll.ts';
import { ListRolls } from '../application/use-cases/rolls/list-rolls.ts';

/** An adapter for every outbound port. */
export interface Adapters {
  readonly rolls: RollRepository;
  readonly blobs: BlobStore;
  readonly inspector: ImageInspector;
  readonly previews: PreviewProvider;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** The use cases, wired to the given adapters. */
export function useCasesFor({
  rolls,
  blobs,
  inspector,
  previews,
  ids,
  clock,
}: Adapters): RollUseCases {
  return {
    createRoll: new CreateRoll(rolls, ids),
    getRoll: new GetRoll(rolls),
    listRolls: new ListRolls(rolls),
    createFrame: new CreateFrame(rolls, ids),
    addVersion: new AddVersion(rolls, blobs, inspector, ids, clock),
    getOriginal: new GetOriginal(rolls, blobs),
    getThumbnail: new GetThumbnail(rolls, blobs, previews),
  };
}
