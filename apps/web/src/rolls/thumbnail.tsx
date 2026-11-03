import type { Frame } from '@filmfile/contracts/rolls';
import { thumbnailUrl } from './thumbnail-url.ts';

/** A frame's newest scan, small or large, named by its file; a placeholder if it has none. */
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
  const version = frame.versions.at(-1);
  if (src === undefined || version === undefined) {
    return <div className="no-scan">No scan</div>;
  }
  return (
    <img
      src={src}
      alt={decorative ? '' : version.file.split('/').at(-1)}
      width={version.width}
      height={version.height}
    />
  );
}
