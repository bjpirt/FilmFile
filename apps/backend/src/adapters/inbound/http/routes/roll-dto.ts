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
  return {
    id: version.id,
    fileName: version.file.split(/[\\/]/u).at(-1) ?? version.file,
    sha256: version.sha256,
    bytes: version.bytes,
    width: version.width,
    height: version.height,
    added: version.added.toISOString(),
    rotate: version.rotate,
    kind: version.kind,
  };
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
    event: frame.event,
    toScan: frame.toScan,
    shot: frame.shot,
    defaultVersion: frame.defaultVersion,
    versions: frame.versions.map(versionDto),
  };
}

export function rollDto(roll: Roll): RollDto {
  return {
    id: roll.id,
    roll: roll.roll,
    filed: roll.filed,
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
  return { ...details };
}
