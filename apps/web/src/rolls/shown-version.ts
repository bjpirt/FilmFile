import type { Frame } from '@filmfile/contracts/rolls';

type Version = Frame['versions'][number];

/** The version shown for a frame: the one chosen (D15), or else its newest. */
export function shownVersion(frame: Frame): Version | undefined {
  return (
    frame.versions.find((version) => version.id === frame.defaultVersion) ??
    frame.versions.at(-1)
  );
}
