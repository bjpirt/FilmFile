import type { Frame } from '@filmfile/contracts/rolls';

type Version = Frame['versions'][number];

/**
 * The version shown for a frame: one chosen in its roll.json (D15), or else
 * its first, the lab scan, however many are added after it (D46).
 */
export function shownVersion(frame: Frame): Version | undefined {
  return (
    frame.versions.find((version) => version.id === frame.defaultVersion) ??
    frame.versions[0]
  );
}
