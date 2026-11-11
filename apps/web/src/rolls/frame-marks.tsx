import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useState } from 'react';
import { EyeIcon } from '../eye-icon.tsx';
import { ScanIcon } from '../scan-icon.tsx';
import { TextIcon } from '../text-icon.tsx';
import { VersionsIcon } from '../versions-icon.tsx';
import { ownDetails } from './own-details.ts';

/** The words for a frame's rating, as screen readers and the hover text say it. */
export function ratingText(rating: number): string {
  return `Rated ${String(rating)} of 5`;
}

export function scanStatus(frame: Frame): string | undefined {
  if (!frame.toScan) {
    return undefined;
  }
  return frame.versions.some(
    (version) => version.kind === 'raw-scan' || version.kind === 'final',
  )
    ? 'Scanned'
    : 'To scan at higher resolution';
}

/**
 * The five stars a frame can be rated with, shown when the pointer is over
 * its thumbnail (FF-149, D62): those up to its rating filled, the rest
 * outlined, and pointing at one previews the rating a click would give. A
 * click on the frame's current rating clears it (D39). Mouse only: the stars
 * are buttons a screen reader can press but Tab skips, and on touch screens
 * they're never shown.
 */
function RatingStrip({
  rating,
  rate,
}: {
  readonly rating: number | null;
  readonly rate: (rating: number | null) => void;
}) {
  // The star pointed at, whose rating a click would give.
  const [pointed, setPointed] = useState<number | undefined>(undefined);
  const shown = pointed ?? rating ?? 0;
  return (
    <span
      className="frame-rating"
      role="group"
      aria-label={rating === null ? 'Not rated' : ratingText(rating)}
      onMouseLeave={() => {
        setPointed(undefined);
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const label =
          star === rating
            ? 'Clear rating'
            : `Rate ${String(star)} ${star === 1 ? 'star' : 'stars'}`;
        return (
          <button
            key={star}
            type="button"
            tabIndex={-1}
            // The star is drawn by CSS, so it adds no text to the frame's caption.
            className={[
              'rate-star',
              star <= shown ? 'filled' : '',
              pointed === undefined ? '' : 'previewing',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={label}
            title={label}
            onMouseEnter={() => {
              setPointed(star);
            }}
            onClick={() => {
              rate(star === rating ? null : star);
            }}
          />
        );
      })}
    </span>
  );
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
  rate,
  hide,
}: {
  readonly frame: Frame;
  readonly roll: Roll;
  /** Whether to show the rating, which gives way to a checkbox while selecting. */
  readonly stars?: boolean;
  readonly readers?: boolean;
  /** Rates the frame from its thumbnail; left out where thumbnails can't rate (the filmstrip, while renumbering or selecting). */
  readonly rate?: (rating: number | null) => void;
  /** Hides or unhides the frame from its thumbnail (D99); left out wherever thumbnails can't. */
  readonly hide?: (hidden: boolean) => void;
}) {
  const own = ownDetails(frame, roll);
  const versions =
    frame.versions.length > 1
      ? `${String(frame.versions.length)} versions`
      : undefined;
  const status = scanStatus(frame);
  const scanned = status === 'Scanned';
  const rating = stars ? frame.rating : null;
  const eyeLabel = `${frame.hidden ? 'Unhide' : 'Hide'} frame ${frame.number ?? 'with no number'}`;
  return (
    <div aria-hidden={readers ? undefined : true}>
      {hide !== undefined && (
        <button
          type="button"
          tabIndex={-1}
          className={
            frame.hidden ? 'frame-hide hidden-frame-eye' : 'frame-hide'
          }
          aria-label={eyeLabel}
          title={eyeLabel}
          onClick={() => {
            hide(!frame.hidden);
          }}
        >
          <EyeIcon size={16} closed={frame.hidden} />
        </button>
      )}
      {rate !== undefined && stars && (
        <RatingStrip rating={frame.rating} rate={rate} />
      )}
      {rating !== null && (
        <span className="frame-stars" title={ratingText(rating)}>
          <span aria-hidden="true">{'★'.repeat(rating)}</span>
          <span className="visually-hidden">{ratingText(rating)}</span>
        </span>
      )}
      {(own !== undefined ||
        versions !== undefined ||
        status !== undefined) && (
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
          {status !== undefined && (
            <span
              className={scanned ? 'frame-mark scanned' : 'frame-mark'}
              title={status}
            >
              <ScanIcon scanned={scanned} size={16} />
              <span className="visually-hidden">{status}</span>
            </span>
          )}
        </span>
      )}
    </div>
  );
}
