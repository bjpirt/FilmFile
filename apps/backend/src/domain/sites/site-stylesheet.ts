/**
 * The site's look (D107): graphic and minimal, white with black type and thin
 * rules, large bold headings, and no colour but the photos. It uses system
 * fonts, since a site loads nothing from the internet.
 */
export const siteStylesheet = `:root {
  --bg: #ffffff;
  --text: #111111;
  --text-muted: #6b6b6b;
  --rule: #111111;
  --line: #e0e0e0;
  --placeholder: #e6e6e6;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2.5rem;
  --font-text: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color-scheme: light;
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
  text-decoration: none;
}

a:hover {
  color: #555555;
}

:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}

.site-header,
.page {
  box-sizing: border-box;
  margin: 0 auto;
  max-width: 75rem;
  padding-inline: var(--space-6);
}

.site-header {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-5);
  justify-content: space-between;
  padding-top: var(--space-6);
}

.site-name {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0;
}

.site-count {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin: 0;
}

.page {
  padding-bottom: 4rem;
  padding-top: 3.5rem;
}

.empty {
  color: var(--text-muted);
}

/* The home page: a section for each year, its heading large over a rule. */
.year {
  margin-bottom: 4.5rem;
}

.year h2 {
  border-bottom: 1px solid var(--rule);
  font-size: clamp(4.5rem, 10vw, 7.5rem);
  font-weight: 800;
  letter-spacing: -0.05em;
  line-height: 0.85;
  margin: 0 0 var(--space-5);
  padding-bottom: var(--space-4);
}

.cards {
  display: grid;
  gap: var(--space-6) var(--space-5);
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  list-style: none;
  margin: 0;
  padding: 0;
}

/* A card: the cover across, then the name and, beside it, the month and count. */
.card a {
  align-items: baseline;
  display: grid;
  gap: var(--space-3);
  grid-template-columns: minmax(0, 1fr) auto;
}

.cover {
  aspect-ratio: 4 / 5;
  background: var(--placeholder);
  display: block;
  grid-column: 1 / -1;
  height: auto;
  object-fit: cover;
  width: 100%;
}

.card a:hover .cover {
  opacity: 0.85;
}

.card h3 {
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
}

.card p {
  color: var(--text-muted);
  font-size: 0.8125rem;
  margin: 0;
  white-space: nowrap;
}

/* The copyright notice at the foot of every page (D108). */
.site-foot {
  box-sizing: border-box;
  color: var(--text-muted);
  font-size: 0.8125rem;
  margin: 0 auto;
  max-width: 75rem;
  padding: 0 var(--space-6) var(--space-6);
}

.site-foot p {
  border-top: 1px solid var(--line);
  margin: 0;
  padding-top: var(--space-5);
}

/* The header's way home from any other page, on its right even with no title. */
.all-events {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin-left: auto;
}

/* An event's page: its name large, its date and count beside it. */
.title-block {
  align-items: end;
  border-bottom: 1px solid var(--rule);
  display: grid;
  gap: var(--space-5) var(--space-6);
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-5);
}

h1 {
  font-size: clamp(3rem, 9vw, 7rem);
  font-weight: 800;
  letter-spacing: -0.05em;
  line-height: 0.9;
  margin: 0;
  overflow-wrap: anywhere;
}

.group-meta {
  font-size: 0.875rem;
  margin: 0;
}

/* A frame's way back to its event. */
.back {
  color: var(--text-muted);
  display: inline-block;
  font-size: 0.875rem;
}

/* The newer and earlier events, at the foot of an event's page. */
.neighbours {
  border-top: 1px solid var(--rule);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-6);
  justify-content: space-between;
  margin-top: var(--space-6);
  padding-top: var(--space-5);
}

.neighbours a {
  display: flex;
  flex-direction: column;
  font-size: 2rem;
  font-weight: 800;
  gap: var(--space-2);
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.neighbours .earlier {
  margin-left: auto;
  text-align: right;
}

.neighbours span {
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 400;
  letter-spacing: normal;
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
  display: block;
  height: auto;
  width: 100%;
}

.photo a:hover img {
  opacity: 0.85;
}

/* A frame's page (D105, D107): the bar, the filmstrip, the photo as large as
   the screen allows between Previous and Next, then its title and date with
   the icon for its details. */
.frame-bar {
  align-items: baseline;
  display: flex;
  gap: var(--space-4);
  justify-content: space-between;
}

.place {
  color: var(--text-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  margin: 0;
}

/* Centred when it fits, scrolling sideways when it doesn't. */
.filmstrip {
  border-bottom: 1px solid var(--line);
  display: flex;
  gap: 4px;
  margin-top: var(--space-4);
  overflow-x: auto;
  padding: 4px 2px var(--space-4);
}

.filmstrip a {
  flex: none;
  opacity: 0.5;
}

.filmstrip a:first-child {
  margin-left: auto;
}

.filmstrip a:last-child {
  margin-right: auto;
}

.filmstrip a:hover,
.filmstrip a[aria-current='page'] {
  opacity: 1;
}

.filmstrip a[aria-current='page'] img {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}

.filmstrip img {
  background: var(--placeholder);
  display: block;
  height: 2.5rem;
  width: auto;
}

/* Room either side for Previous and Next, outside the photo. */
.frame-stage {
  display: flex;
  justify-content: center;
  margin: var(--space-5) 0 var(--space-4);
  padding-inline: 3.5rem;
}

.frame-stage img {
  display: block;
  height: auto;
  /* Room for the header, the bar, the filmstrip and the caption line. */
  max-height: calc(100vh - 20rem);
  max-width: 100%;
  min-width: 0;
  object-fit: contain;
  width: auto;
}

.frame-photo {
  position: relative;
}

/* Previous and Next, level with the middle of the photo, just outside it. */
.step {
  color: var(--text);
  font-size: 2.5rem;
  line-height: 1;
  padding: var(--space-3);
  position: absolute;
  text-decoration: none;
  top: 50%;
  transform: translateY(-50%);
}

.step.previous {
  right: 100%;
}

.step.next {
  left: 100%;
}

.step:hover {
  color: var(--text-muted);
}

/* The photo and its caption line together, as wide as the photo. */
.frame-figure {
  display: flex;
  flex-direction: column;
  margin: 0;
  min-width: 0;
}

.frame-info {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-4);
  margin-top: var(--space-2);
  /* Takes the photo's width, never widens the figure past it. */
  contain: inline-size;
}

.caption {
  margin: 0;
}

.caption span {
  color: var(--text-muted);
}

/* The details, always shown, each a small grey label over its value. */
.frame-details {
  display: grid;
  flex-basis: 100%;
  font-size: 0.8125rem;
  gap: var(--space-3) var(--space-5);
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  margin: var(--space-3) 0 0;
}

.frame-details dt {
  color: var(--text-muted);
}

.frame-details dd {
  margin: var(--space-2) 0 0;
}

/* On a phone: two cards to a row, and the photo the whole width with small
   arrows over its edges. */
@media (max-width: 40rem) {
  .site-header,
  .page,
  .site-foot {
    padding-inline: var(--space-4);
  }

  .site-header {
    padding-top: var(--space-5);
  }

  .page {
    padding-top: var(--space-6);
  }

  .year h2 {
    font-size: 4.5rem;
  }

  .cards {
    gap: var(--space-5) var(--space-3);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .card a {
    gap: var(--space-2);
    grid-template-columns: minmax(0, 1fr);
  }

  .title-block {
    grid-template-columns: minmax(0, 1fr);
  }

  .neighbours a {
    font-size: 1.5rem;
  }

  .frame-figure {
    width: 100%;
  }

  .frame-stage img {
    max-height: none;
    width: 100%;
  }

  .frame-details {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .frame-stage {
    padding-inline: 0;
  }

  /* Over the photo's edges, since there's no room beside it. */
  .step {
    background: rgb(255 255 255 / 70%);
    font-size: 1.75rem;
    padding: var(--space-2) var(--space-3);
  }

  .step.previous {
    left: var(--space-2);
    right: auto;
  }

  .step.next {
    left: auto;
    right: var(--space-2);
  }
}
`;
