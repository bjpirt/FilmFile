/**
 * What a version is (D48): a scan, ready to view at whatever resolution; a
 * raw scan, the negative or slide as scanned, not yet processed; or a
 * final, processed and edited.
 */
export const versionKinds = ['scan', 'raw-scan', 'final'] as const;

export type VersionKind = (typeof versionKinds)[number];

export function isVersionKind(value: string): value is VersionKind {
  return versionKinds.some((kind) => kind === value);
}
