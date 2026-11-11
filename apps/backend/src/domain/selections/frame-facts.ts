import type { ResolvedDetails } from '../details/details.ts';
import type { Rating } from '../rolls/rating.ts';
import type { Frame, Roll } from '../rolls/roll.ts';
import type { FrameId, RollId } from '../shared/ids.ts';
import type { Slug } from '../shared/slug.ts';
import type { VersionKind } from '../rolls/version-kind.ts';

/** What rules are matched against: a frame with its details as they resolve (D45, D50). */
export interface FrameFacts {
  readonly rollId: RollId;
  readonly frameId: FrameId;
  readonly rollNumber: string;
  /** Where the frame is on its roll, to keep a roll's own order. */
  readonly position: number;
  readonly hidden: boolean;
  readonly rating: Rating | null;
  readonly event: Slug | undefined;
  readonly camera: Slug | undefined;
  readonly lens: Slug | undefined;
  readonly film: Slug | undefined;
  /** When it was shot, as precisely as known: its own, else its roll's. */
  readonly shot: string | undefined;
  readonly versionKinds: ReadonlySet<VersionKind>;
}

export function frameFactsOf(
  roll: Roll,
  frame: Frame,
  details: ResolvedDetails,
): FrameFacts {
  return {
    rollId: roll.id,
    frameId: frame.id,
    rollNumber: roll.roll,
    position: roll.frames.indexOf(frame),
    hidden: frame.hidden,
    rating: frame.rating,
    event: details.event?.value,
    camera: details.camera?.value,
    lens: details.lens?.value,
    film: details.film?.value,
    shot: details.shot?.value,
    versionKinds: new Set(frame.versions.map((version) => version.kind)),
  };
}
