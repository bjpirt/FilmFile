/** An open eye, or a closed one with a lid line, for a hide button named by its aria-label. */
export function EyeIcon({
  size,
  closed,
}: {
  readonly size: number;
  readonly closed: boolean;
}) {
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
      {closed ? (
        <path d="M3 10c2.5 4 15.5 4 18 0M6.5 14l-1.5 2.5M12 15.5V18M17.5 14l1.5 2.5" />
      ) : (
        <>
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.8" />
        </>
      )}
    </svg>
  );
}
