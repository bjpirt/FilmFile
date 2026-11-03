import type { EquipmentUseCases } from '../adapters/inbound/http/routes/equipment.ts';
import type { RollUseCases } from '../adapters/inbound/http/routes/rolls.ts';
import type { BlobStore } from '../application/ports/blob-store.ts';
import type { Clock } from '../application/ports/clock.ts';
import type { EquipmentRepository } from '../application/ports/equipment-repository.ts';
import type { IdGenerator } from '../application/ports/id-generator.ts';
import type { ImageInspector } from '../application/ports/image-inspector.ts';
import type { PreviewProvider } from '../application/ports/preview-provider.ts';
import type { RollRepository } from '../application/ports/roll-repository.ts';
import { CreateCamera } from '../application/use-cases/equipment/create-camera.ts';
import { ListCameras } from '../application/use-cases/equipment/list-cameras.ts';
import { AddVersion } from '../application/use-cases/frames/add-version.ts';
import { CreateFrame } from '../application/use-cases/frames/create-frame.ts';
import { GetOriginal } from '../application/use-cases/frames/get-original.ts';
import { GetThumbnail } from '../application/use-cases/frames/get-thumbnail.ts';
import { UpdateFrame } from '../application/use-cases/frames/update-frame.ts';
import { UpdateFrameNumbers } from '../application/use-cases/frames/update-frame-numbers.ts';
import { CreateRoll } from '../application/use-cases/rolls/create-roll.ts';
import { GetRoll } from '../application/use-cases/rolls/get-roll.ts';
import { ListRolls } from '../application/use-cases/rolls/list-rolls.ts';
import { UpdateRoll } from '../application/use-cases/rolls/update-roll.ts';

/** An adapter for every outbound port. */
export interface Adapters {
  readonly rolls: RollRepository;
  readonly equipment: EquipmentRepository;
  readonly blobs: BlobStore;
  readonly inspector: ImageInspector;
  readonly previews: PreviewProvider;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** The use cases, wired to the given adapters. */
export function useCasesFor({
  rolls,
  equipment,
  blobs,
  inspector,
  previews,
  ids,
  clock,
}: Adapters): RollUseCases & EquipmentUseCases {
  return {
    createRoll: new CreateRoll(rolls, equipment, ids),
    getRoll: new GetRoll(rolls),
    listRolls: new ListRolls(rolls),
    updateRoll: new UpdateRoll(rolls, equipment),
    createFrame: new CreateFrame(rolls, ids),
    updateFrame: new UpdateFrame(rolls),
    updateFrameNumbers: new UpdateFrameNumbers(rolls),
    addVersion: new AddVersion(rolls, blobs, inspector, ids, clock),
    getOriginal: new GetOriginal(rolls, blobs),
    getThumbnail: new GetThumbnail(rolls, blobs, previews),
    listCameras: new ListCameras(equipment),
    createCamera: new CreateCamera(equipment),
  };
}
