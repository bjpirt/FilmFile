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
  align-items: baseline;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-5);
  justify-content: space-between;
  padding: var(--space-4);
}

.site-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.site-name a {
  text-decoration: none;
}

/* "Events | Rolls" with Both (D104): the view shown in the accent colour. */
.views {
  display: flex;
  gap: var(--space-4);
}

.views a {
  color: var(--text-muted);
  text-decoration: none;
}

.views a[aria-current='page'] {
  color: var(--accent);
}

h1 {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 var(--space-2);
}

.back {
  color: var(--text-muted);
  display: inline-block;
  margin-bottom: var(--space-3);
  text-decoration: none;
}

.group-meta {
  color: var(--text-muted);
  margin: 0 0 var(--space-5);
}

/* A card for each roll or event, as on the app's rolls and events pages. */
.cards {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  list-style: none;
  margin: 0;
  padding: 0;
}

.card a {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: block;
  overflow: hidden;
  text-decoration: none;
}

.card a:hover {
  border-color: var(--text-muted);
}

.peek {
  background: #0b0c0d;
  display: grid;
  gap: 2px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.peek img,
.peek-empty {
  aspect-ratio: 3 / 2;
  background: var(--placeholder);
  display: block;
  object-fit: cover;
  width: 100%;
}

.card h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  padding: var(--space-3) var(--space-4) 0;
}

.card p {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin: 0;
  padding: var(--space-2) var(--space-4) var(--space-4);
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

/* A frame's page (D105): the photo as large as the screen allows, between
   Previous and Next, its caption, and the filmstrip below. */
.frame-bar {
  align-items: baseline;
  display: flex;
  gap: var(--space-4);
  justify-content: space-between;
}

.frame-bar .back {
  margin: 0;
}

.place {
  color: var(--text-muted);
  margin: 0;
}

.frame-stage {
  align-items: center;
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  margin: var(--space-4) 0 var(--space-3);
  position: relative;
}

.frame-stage img {
  border-radius: var(--radius);
  display: block;
  height: auto;
  /* Room for the header, the bar, the caption and the filmstrip. */
  max-height: calc(100vh - 19rem);
  max-width: 100%;
  min-width: 0;
  object-fit: contain;
  width: auto;
}

.step {
  color: var(--text-muted);
  font-size: 2.5rem;
  line-height: 1;
  padding: var(--space-3);
  text-decoration: none;
}

.step:hover {
  color: var(--accent);
}

.caption {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin: 0 0 var(--space-4);
  text-align: center;
}

.filmstrip {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px 2px;
  position: relative;
}

.filmstrip a {
  flex: none;
  opacity: 0.6;
}

.filmstrip a:hover,
.filmstrip a[aria-current='page'] {
  opacity: 1;
}

.filmstrip a[aria-current='page'] img {
  outline: 2px solid var(--accent);
}

.filmstrip img {
  background: var(--placeholder);
  border-radius: 3px;
  display: block;
  height: 4rem;
  width: auto;
}

/* On a phone the photo takes the whole width, with small arrows over its edges. */
@media (max-width: 40rem) {
  .frame-stage img {
    max-height: none;
    width: 100%;
  }

  .step {
    background: rgb(0 0 0 / 45%);
    border-radius: var(--radius);
    font-size: 1.75rem;
    padding: var(--space-2) var(--space-3);
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
  }

  .step.previous {
    left: var(--space-2);
  }

  .step.next {
    right: var(--space-2);
  }
}
`;
