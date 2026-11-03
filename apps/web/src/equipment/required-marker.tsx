/** The orange * beside a required field's label; the label alone is read out. */
export function RequiredMarker() {
  return (
    <span className="required" aria-hidden="true">
      *
    </span>
  );
}
