import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { TextIcon } from '../text-icon.tsx';
import { VersionsIcon } from '../versions-icon.tsx';
import { ownDetails } from './own-details.ts';

/** The words for a frame's rating, as screen readers and the hover text say it. */
export function ratingText(rating: number): string {
  return `Rated ${String(rating)} of 5`;
}

/**
 * What a frame says about itself, drawn over its thumbnail, so every place
 * a frame is shown says the same (FF-148, D62): its rating as filled stars at
 * the top left, and small icons at the bottom left for details of its own or
 * notes (U69) and for more than one version (U70). Put in the thumbnail's
 * `frame-picture`. The icons are named in full for screen readers and on
 * hover, or only on hover with `readers: false`, where the frame's link
 * names it already (the filmstrip).
 */
export function FrameMarks({
  frame,
  roll,
  stars = true,
  readers = true,
}: {
  readonly frame: Frame;
  readonly roll: Roll;
  /** Whether to show the rating, which gives way to a checkbox while selecting. */
  readonly stars?: boolean;
  readonly readers?: boolean;
}) {
  const own = ownDetails(frame, roll);
  const versions =
    frame.versions.length > 1
      ? `${String(frame.versions.length)} versions`
      : undefined;
  const rating = stars ? frame.rating : null;
  return (
    <div aria-hidden={readers ? undefined : true}>
      {rating !== null && (
        <span className="frame-stars" title={ratingText(rating)}>
          <span aria-hidden="true">{'★'.repeat(rating)}</span>
          <span className="visually-hidden">{ratingText(rating)}</span>
        </span>
      )}
      {(own !== undefined || versions !== undefined) && (
        <span className="frame-marks">
          {own !== undefined && (
            <span className="frame-mark" title={own}>
              <TextIcon size={16} />
              <span className="visually-hidden">{own}</span>
            </span>
          )}
          {versions !== undefined && (
            <span className="frame-mark" title={versions}>
              <VersionsIcon size={16} />
              <span className="visually-hidden">{versions}</span>
            </span>
          )}
        </span>
      )}
    </div>
  );
}
