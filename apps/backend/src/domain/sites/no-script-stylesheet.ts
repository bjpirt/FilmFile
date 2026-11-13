/**
 * Loaded only when scripts are off (a frame page's `<noscript>`): a frame's
 * details are shown, since there's no script to show them, and the icon that
 * would is hidden.
 */
export const noScriptStylesheet = `.frame-details[hidden] {
  display: grid;
}

.info-toggle {
  display: none;
}
`;
