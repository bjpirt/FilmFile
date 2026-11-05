export function PadlockIcon({ size }: { readonly size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
      <path d="M8 10v1.5" />
    </svg>
  );
}
