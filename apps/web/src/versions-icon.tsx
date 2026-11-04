/** Pictures stacked, for a frame with more than one version, named by hidden text beside it. */
export function VersionsIcon({ size }: { readonly size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="3" width="13" height="13" rx="1.5" />
      <path d="M16 20H5a1.5 1.5 0 0 1-1.5-1.5V8" />
      <path d="m8 13 3.5-3.5L15 13l2-2 4 4" />
    </svg>
  );
}
