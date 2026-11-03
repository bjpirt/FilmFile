/** A version token as an ETag: quoted, as HTTP requires. */
export function etagOf(version: string): string {
  return `"${version}"`;
}

/** The version in an If-Match header, which may be quoted and marked weak. */
export function versionFrom(ifMatch: string): string {
  return ifMatch.replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
}
