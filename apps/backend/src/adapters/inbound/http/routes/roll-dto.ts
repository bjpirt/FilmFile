import type { Roll as RollDto } from '@filmfile/contracts/rolls';
import type { Roll, Version } from '../../../../domain/rolls/roll.ts';

// Domain types to the API's response shapes.

export function versionDto(
  version: Version,
): RollDto['frames'][number]['versions'][number] {
  return { ...version, added: version.added.toISOString() };
}

export function rollDto(roll: Roll): RollDto {
  return {
    id: roll.id,
    roll: roll.roll,
    name: roll.name,
    description: roll.description,
    shot: roll.shot,
    event: roll.event,
    camera: roll.camera,
    film: roll.film,
    lens: roll.lens,
    frames: roll.frames.map((frame) => ({
      id: frame.id,
      number: frame.number,
      versions: frame.versions.map(versionDto),
    })),
  };
}
