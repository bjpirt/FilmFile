import type {
  FrameDetails as FrameDetailsDto,
  Roll as RollDto,
} from '@filmfile/contracts/rolls';
import type { ResolvedDetails } from '../../../../domain/details/details.ts';
import type { Frame, Roll, Version } from '../../../../domain/rolls/roll.ts';

// Domain types to the API's response shapes.

export function versionDto(
  version: Version,
): RollDto['frames'][number]['versions'][number] {
  return { ...version, added: version.added.toISOString() };
}

export function frameDto(frame: Frame): RollDto['frames'][number] {
  return {
    id: frame.id,
    number: frame.number,
    title: frame.title,
    rating: frame.rating,
    notes: frame.notes,
    camera: frame.camera,
    lens: frame.lens,
    events: frame.events === null ? null : [...frame.events],
    shot: frame.shot,
    defaultVersion: frame.defaultVersion,
    versions: frame.versions.map(versionDto),
  };
}

export function rollDto(roll: Roll): RollDto {
  return {
    id: roll.id,
    roll: roll.roll,
    name: roll.name,
    notes: roll.notes,
    shot: roll.shot,
    event: roll.event,
    camera: roll.camera,
    film: roll.film,
    lens: roll.lens,
    frames: roll.frames.map(frameDto),
  };
}

export function frameDetailsDto(details: ResolvedDetails): FrameDetailsDto {
  const { events, ...scalars } = details;
  return {
    ...scalars,
    ...(events === undefined
      ? {}
      : { events: { value: [...events.value], source: events.source } }),
  };
}
