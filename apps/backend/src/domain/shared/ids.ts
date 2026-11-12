import type { ValidationFailed } from './domain-error.ts';
import { err, ok, type Result } from './result.ts';

// IDs are ULIDs. Each kind is branded so that, say, a FrameId can't be passed
// where a RollId is expected, though both are strings at runtime.

declare const brand: unique symbol;
type Branded<Kind extends string> = string & { readonly [brand]: Kind };

export type ArchiveId = Branded<'ArchiveId'>;
export type RollId = Branded<'RollId'>;
export type FrameId = Branded<'FrameId'>;
export type VersionId = Branded<'VersionId'>;
export type SiteId = Branded<'SiteId'>;

const ulid = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isArchiveId(value: string): value is ArchiveId {
  return ulid.test(value);
}

export function isRollId(value: string): value is RollId {
  return ulid.test(value);
}

export function isFrameId(value: string): value is FrameId {
  return ulid.test(value);
}

export function isVersionId(value: string): value is VersionId {
  return ulid.test(value);
}

export function isSiteId(value: string): value is SiteId {
  return ulid.test(value);
}

function parseWith<Id extends string>(
  isId: (value: string) => value is Id,
  value: string,
): Result<Id, ValidationFailed> {
  return isId(value)
    ? ok(value)
    : err({
        kind: 'validation-failed',
        issues: [{ path: [], message: 'must be a ULID' }],
      });
}

export function parseArchiveId(
  value: string,
): Result<ArchiveId, ValidationFailed> {
  return parseWith(isArchiveId, value);
}

export function parseRollId(value: string): Result<RollId, ValidationFailed> {
  return parseWith(isRollId, value);
}

export function parseFrameId(value: string): Result<FrameId, ValidationFailed> {
  return parseWith(isFrameId, value);
}

export function parseVersionId(
  value: string,
): Result<VersionId, ValidationFailed> {
  return parseWith(isVersionId, value);
}

export function parseSiteId(value: string): Result<SiteId, ValidationFailed> {
  return parseWith(isSiteId, value);
}
