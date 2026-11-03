import type { Camera } from '@filmfile/contracts/equipment';
import {
  blankCamera,
  type CameraChoice,
  type NewCamera,
} from './camera-choice.ts';
import { EquipmentSelect } from './equipment-select.tsx';
import { RequiredMarker } from './required-marker.tsx';
import { cameraLabel } from './use-cameras.ts';

/** A camera picked from the archive's, or Add new…, which asks for its make and model. */
export function CameraField({
  cameras,
  choice,
  change,
}: {
  readonly cameras: readonly Camera[];
  readonly choice: CameraChoice;
  readonly change: (choice: CameraChoice) => void;
}) {
  function changeDetail(details: NewCamera, detail: Partial<NewCamera>) {
    change({ kind: 'new', details: { ...details, ...detail } });
  }

  return (
    <>
      <EquipmentSelect
        label="Camera"
        options={cameras.map((camera) => ({
          slug: camera.slug,
          label: cameraLabel(camera),
        }))}
        choice={choice}
        blank={blankCamera}
        change={change}
      />
      {choice.kind === 'new' && (
        <fieldset className="new-equipment">
          <legend>New camera</legend>
          <label>
            <span>
              Make <RequiredMarker />
            </span>
            <input
              value={choice.details.make}
              placeholder="Nikon"
              maxLength={50}
              autoFocus
              onChange={(event) => {
                changeDetail(choice.details, { make: event.target.value });
              }}
            />
          </label>
          <label>
            <span>
              Model <RequiredMarker />
            </span>
            <input
              value={choice.details.model}
              placeholder="FE"
              maxLength={100}
              onChange={(event) => {
                changeDetail(choice.details, { model: event.target.value });
              }}
            />
          </label>
        </fieldset>
      )}
    </>
  );
}
