/** Where a sync keeps its record and manifest in the bucket, beside the library's mirror (D117). */
export const bucketKeys: {
  readonly syncRecord: string;
  readonly manifest: string;
} = {
  syncRecord: 'filmfile/sync.json',
  manifest: 'filmfile/manifest.json',
};
