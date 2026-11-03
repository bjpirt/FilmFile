import type { Camera } from '@filmfile/contracts/equipment';

/** A camera, typed or picked from the archive's cameras; a new name adds a camera. */
export function CameraField({
  cameras,
  value,
  change,
}: {
  readonly cameras: readonly Camera[];
  readonly value: string;
  readonly change: (value: string) => void;
}) {
  return (
    <label>
      Camera
      <input
        list="camera-options"
        value={value}
        placeholder="Nikon FE"
        maxLength={100}
        onChange={(event) => {
          change(event.target.value);
        }}
      />
      <datalist id="camera-options">
        {cameras.map((camera) => (
          <option key={camera.slug} value={camera.name} />
        ))}
      </datalist>
    </label>
  );
}
