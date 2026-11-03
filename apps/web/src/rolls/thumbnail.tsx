import type { Frame } from '@filmfile/contracts/rolls';
import { thumbnailUrl } from './thumbnail-url.ts';

/** A frame's newest scan, small, named by its file; a placeholder if it has none. */
export function Thumbnail({
  rollId,
  frame,
}: {
  readonly rollId: string;
  readonly frame: Frame;
}) {
  const src = thumbnailUrl(rollId, frame);
  const version = frame.versions.at(-1);
  if (src === undefined || version === undefined) {
    return <div className="no-scan">No scan</div>;
  }
  return (
    <img
      src={src}
      alt={version.file.split('/').at(-1)}
      width={version.width}
      height={version.height}
    />
  );
}
