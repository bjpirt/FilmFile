export function ScanIcon({
  scanned,
  size,
}: {
  readonly scanned: boolean;
  readonly size: number;
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
      <path d="M4 8h16v11H4z" />
      <path d="M7 8V5h10v3M7 12h10M7 16h4" />
      {scanned && <path strokeWidth="2.2" d="m14 16 2 2 4-4" />}
    </svg>
  );
}
