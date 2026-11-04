/** Lines of text, for a mark named by hidden text beside it rather than shown in words. */
export function TextIcon({ size }: { readonly size: number }) {
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
      <path d="M5 6h14M5 10h14M5 14h14M5 18h9" />
    </svg>
  );
}
