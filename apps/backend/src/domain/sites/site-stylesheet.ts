/**
 * The site's look is the app's light table (D21): dark, photo first, the same
 * colours, spacing and type. It uses system fonts, since a site loads nothing
 * from the internet.
 */
export const siteStylesheet = `:root {
  --bg: #111214;
  --surface: #1b1d21;
  --border: #2a2d33;
  --text: #e8e6e3;
  --text-muted: #9a9ea6;
  --accent: #f2a93b;
  --placeholder: #24272c;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --radius: 6px;
  --font-text: Inter, system-ui, sans-serif;
  color-scheme: dark;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-text);
  font-size: 15px;
  line-height: 1.45;
}

body {
  margin: 0;
}

a {
  color: inherit;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.page {
  margin: 0 auto;
  max-width: 90rem;
  padding: var(--space-6) var(--space-4);
}

.site-header {
  margin-bottom: var(--space-6);
  max-width: 42rem;
}

h1 {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 var(--space-3);
}

.intro p {
  color: var(--text-muted);
  margin: 0 0 var(--space-3);
}

.group {
  margin-bottom: var(--space-6);
}

.group h2 {
  align-items: baseline;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  font-size: 1.1rem;
  font-weight: 600;
  gap: var(--space-3);
  margin: 0 0 var(--space-4);
  padding-bottom: var(--space-2);
}

.group h2 small {
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 400;
}

/* Rows that fill the width: each photo grows in proportion to its shape. */
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.grid::after {
  content: '';
  flex-grow: 1000000;
}

.photo {
  flex: calc(var(--shape) * 100) 1 calc(var(--shape) * 14rem);
  margin: 0;
  min-width: 8rem;
}

.photo a {
  display: block;
}

.photo img {
  aspect-ratio: var(--shape);
  background: var(--placeholder);
  border-radius: var(--radius);
  display: block;
  height: auto;
  width: 100%;
}

.photo a:hover img {
  outline: 2px solid var(--accent);
}

.photo figcaption {
  color: var(--text-muted);
  font-size: 0.85rem;
  padding-top: var(--space-2);
}

.empty {
  color: var(--text-muted);
}

/* The lightbox */

dialog {
  background: var(--bg);
  border: 0;
  color: var(--text);
  height: 100%;
  max-height: none;
  max-width: none;
  padding: 0;
  width: 100%;
}

dialog::backdrop {
  background: var(--bg);
}

.lightbox {
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100%;
}

.lightbox img {
  height: 100%;
  min-height: 0;
  object-fit: contain;
  padding: var(--space-4);
  box-sizing: border-box;
  width: 100%;
}

.lightbox-bar {
  align-items: center;
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
}

.lightbox-caption {
  color: var(--text-muted);
  flex: 1;
  margin: 0;
}

.lightbox button {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  min-height: 2.5rem;
  min-width: 2.5rem;
  padding: 0 var(--space-3);
}

.lightbox button:hover {
  border-color: var(--accent);
}
`;
