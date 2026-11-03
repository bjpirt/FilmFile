import type { Frame } from '@filmfile/contracts/rolls';
import { shownVersion } from './shown-version.ts';
import { thumbnailUrl } from './thumbnail-url.ts';

/** The scan shown for a frame, small or large, named by its file; a placeholder if it has none. */
export function Thumbnail({
  rollId,
  frame,
  size = 'small',
  decorative = false,
}: {
  readonly rollId: string;
  readonly frame: Frame;
  readonly size?: 'small' | 'large';
  /** Unnamed, when what it's in already names the frame, e.g. a labelled link. */
  readonly decorative?: boolean;
}) {
  const src = thumbnailUrl(rollId, frame, size);
  const version = shownVersion(frame);
  if (src === undefined || version === undefined) {
    return <div className="no-scan">No scan</div>;
  }
  // A quarter turn either way swaps the shape the browser makes room for.
  const sideways = version.rotate === 90 || version.rotate === 270;
  return (
    <img
      src={src}
      alt={decorative ? '' : version.file.split('/').at(-1)}
      width={sideways ? version.height : version.width}
      height={sideways ? version.width : version.height}
    />
  );
}
