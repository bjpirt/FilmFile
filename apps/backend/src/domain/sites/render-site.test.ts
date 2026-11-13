import { describe, expect, test } from 'vitest';
import { renderSite } from './render-site.ts';
import { noPhotosText } from './render-home-page.ts';
import type { SiteOptions } from './site-options.ts';
import type { GroupLabel, SitePhoto } from './site-photo.ts';
import { isFrameId, type FrameId } from '../shared/ids.ts';

const options: SiteOptions = {
  title: 'Iceland highlights',
  captions: ['title'],
};

function frameId(name: string): FrameId {
  const id = name.padStart(26, '0');
  if (!isFrameId(id)) {
    throw new Error(`bad test data: ${name}`);
  }
  return id;
}

const westfjords: GroupLabel = {
  key: 'r1',
  heading: '2026-004 Westfjords',
  file: '2026-004-AAAAAAAA',
};
const norway: GroupLabel = {
  key: 'r2',
  heading: '2026-005 Norway',
  file: '2026-005-BBBBBBBB',
};
const iceland: GroupLabel = {
  key: 'iceland',
  heading: 'Iceland 2026',
  detail: 'Sep 2026',
  file: 'iceland',
};

function aPhoto(name: string, extra: Partial<SitePhoto> = {}): SitePhoto {
  return {
    frame: frameId(name),
    alt: `Frame ${name}`,
    images: [
      { src: `images/${name}-640.jpg`, width: 640, madeFrom: `h${name}a` },
      { src: `images/${name}-1600.jpg`, width: 1600, madeFrom: `h${name}b` },
    ],
    width: 1600,
    height: 1067,
    file: `${name}-F${name}`,
    rating: null,
    roll: westfjords,
    details: { shot: '12 Sep 2026' },
    ...extra,
  };
}

function files(photos: readonly SitePhoto[], over: Partial<SiteOptions> = {}) {
  return renderSite(photos, { ...options, ...over });
}

function file(
  photos: readonly SitePhoto[],
  path: string,
  over: Partial<SiteOptions> = {},
): string {
  const found = files(photos, over).find(
    (candidate) => candidate.path === path,
  );
  if (found === undefined) {
    throw new Error(`no ${path}`);
  }
  return found.content;
}

describe('the files', () => {
  test('the home page, a page for each event and each roll and for each frame in them, and the assets', () => {
    const photos = [
      aPhoto('1', { event: iceland }),
      aPhoto('2', { roll: norway }),
    ];
    expect(files(photos).map((made) => made.path)).toEqual([
      'index.html',
      'events/iceland.html',
      'events/iceland/1-F1.html',
      'events/_no-event-2026.html',
      'events/_no-event-2026/2-F2.html',
      'rolls/2026-005-BBBBBBBB.html',
      'rolls/2026-005-BBBBBBBB/2-F2.html',
      'rolls/2026-004-AAAAAAAA.html',
      'rolls/2026-004-AAAAAAAA/1-F1.html',
      'assets/site.css',
      'assets/site.js',
    ]);
  });

  test('with no photos, the home page says so and there are no other pages', () => {
    expect(files([]).map((made) => made.path)).toEqual([
      'index.html',
      'assets/site.css',
      'assets/site.js',
    ]);
    expect(file([], 'index.html')).toContain(noPhotosText);
  });

  test('makes byte-identical files from the same inputs', () => {
    expect(files([aPhoto('1')])).toEqual(files([aPhoto('1')]));
  });

  test('uses only relative links, so it works from any folder', () => {
    for (const made of files([aPhoto('1', { event: iceland })])) {
      expect(made.content).not.toMatch(/(?:href|src)="(?:\/|https?:)/);
    }
  });

  test('has no menu of views and no inline styles on any page', () => {
    for (const made of files([aPhoto('1', { event: iceland })])) {
      expect(made.content).not.toContain('class="views"');
      if (made.path.endsWith('.html')) {
        expect(made.content).not.toContain('style=');
      }
    }
  });
});

const lake: GroupLabel = {
  key: 'lake',
  heading: 'Lake District',
  detail: '14 Jul 2026',
  file: 'lake',
};
const cornwall: GroupLabel = {
  key: 'cornwall',
  heading: 'Cornwall',
  detail: 'Aug 2025',
  file: 'cornwall',
};

/** The home page's sections, as their headings and the cards' headings in each. */
function sectionsOf(html: string): { year: string; cards: string[] }[] {
  return [...html.matchAll(/<section class="year">(.*?)<\/section>/gs)].map(
    (section) => {
      const body = section[1] ?? '';
      return {
        year: /<h2>([^<]*)<\/h2>/.exec(body)?.[1] ?? '',
        cards: [...body.matchAll(/<h3>([^<]*)<\/h3>/g)].map((m) => m[1] ?? ''),
      };
    },
  );
}

/** Iceland 2026 with no date of its own. */
const noDate: GroupLabel = {
  key: 'iceland',
  heading: 'Iceland 2026',
  file: 'iceland',
};

describe('the home page', () => {
  test('names the site, as its heading and title, with how many events and photographs it has', () => {
    const html = file(
      [
        aPhoto('1', { event: iceland }),
        aPhoto('2', { event: lake }),
        aPhoto('3'),
      ],
      'index.html',
    );
    expect(html).toContain('<title>Iceland highlights</title>');
    expect(html).toContain(
      '<h1 class="site-name"><a href="index.html">Iceland highlights</a></h1>',
    );
    expect(html).toContain(
      '<p class="site-count">2 events · 3 photographs</p>',
    );
    expect(file([aPhoto('1', { event: iceland })], 'index.html')).toContain(
      '<p class="site-count">1 event · 1 photograph</p>',
    );
    expect(file([aPhoto('1')], 'index.html')).toContain(
      '<p class="site-count">1 photograph</p>',
    );
  });

  test('puts the events under their years, newest first', () => {
    const html = file(
      [
        aPhoto('1', { event: cornwall, details: { shot: 'Aug 2025' } }),
        aPhoto('2', { event: lake, details: { shot: '14 Jul 2026' } }),
        aPhoto('3', { event: iceland }),
      ],
      'index.html',
    );
    expect(sectionsOf(html)).toEqual([
      { year: '2026', cards: ['Iceland 2026', 'Lake District'] },
      { year: '2025', cards: ['Cornwall'] },
    ]);
  });

  test('a card leads to its event’s page with its cover, its name, its month and its count', () => {
    const html = file(
      [aPhoto('1', { event: lake }), aPhoto('2', { event: lake })],
      'index.html',
    );
    expect(html).toContain(
      '<li class="card"><a href="events/lake.html"><img class="cover" src="images/1-640.jpg" srcset="images/1-640.jpg 640w, images/1-1600.jpg 1600w" sizes="(max-width: 40rem) 90vw, 50vw" alt="" loading="lazy"><h3>Lake District</h3><p>Jul · 2 photos</p></a></li>',
    );
  });

  test('an event known only by its year has no month, and one photo is "1 photo"', () => {
    const html = file(
      [aPhoto('1', { event: { ...iceland, detail: '2026' } })],
      'index.html',
    );
    expect(html).toContain('<h3>Iceland 2026</h3><p>1 photo</p>');
  });

  test('an event’s cover is its highest rated photo, the earliest among equals', () => {
    const html = file(
      [
        aPhoto('1', { event: iceland, rating: 2 }),
        aPhoto('2', { event: iceland, rating: 4 }),
        aPhoto('3', { event: iceland, rating: 4 }),
      ],
      'index.html',
    );
    expect(html).toContain('<img class="cover" src="images/2-640.jpg"');
  });

  test('an event with no date takes its year and month from its first frame', () => {
    const html = file(
      [aPhoto('1', { event: noDate, details: { shot: '3 Mar 2025' } })],
      'index.html',
    );
    expect(sectionsOf(html)).toEqual([
      { year: '2025', cards: ['Iceland 2026'] },
    ]);
    expect(html).toContain('<p>Mar · 1 photo</p>');
  });

  test('frames in no event are "Other photos from" their year, after that year’s events, leading to their own page', () => {
    const html = file(
      [
        aPhoto('1', { details: { shot: 'Mar 2025' } }),
        aPhoto('2', { event: lake }),
        aPhoto('3'),
        aPhoto('4', { event: cornwall, details: { shot: 'Aug 2025' } }),
      ],
      'index.html',
    );
    expect(sectionsOf(html)).toEqual([
      { year: '2026', cards: ['Lake District', 'Other photos from 2026'] },
      { year: '2025', cards: ['Cornwall', 'Other photos from 2025'] },
    ]);
    expect(html).toContain(
      '<a href="events/_no-event-2026.html"><img class="cover" src="images/3-640.jpg"',
    );
    expect(html).toContain('<h3>Other photos from 2025</h3><p>1 photo</p>');
    expect(html).toContain(
      '<p class="site-count">2 events · 4 photographs</p>',
    );
  });

  test('a year’s other photos have their own page, and each its frame page there', () => {
    const photos = [aPhoto('1'), aPhoto('2')];
    const page = file(photos, 'events/_no-event-2026.html');
    expect(page).toContain('<h1>Other photos from 2026</h1>');
    expect(page).toContain('<a href="_no-event-2026/1-F1.html">');
    expect(file(photos, 'events/_no-event-2026/2-F2.html')).toContain(
      '<a class="back" href="../_no-event-2026.html">← Other photos from 2026</a>',
    );
  });

  test('undated frames in no event, and events with no date at all, are under "Other", after the years', () => {
    const html = file(
      [
        aPhoto('1', { details: {} }),
        aPhoto('2', { event: lake }),
        aPhoto('3', { event: noDate, details: {} }),
      ],
      'index.html',
    );
    expect(sectionsOf(html)).toEqual([
      { year: '2026', cards: ['Lake District'] },
      { year: 'Other', cards: ['Iceland 2026', 'Other photos'] },
    ]);
    expect(html).toContain('<a href="events/_no-event.html">');
  });

  test('ends with its rolls, newest first, each leading to its page', () => {
    const html = file(
      [aPhoto('1', { roll: westfjords }), aPhoto('2', { roll: norway })],
      'index.html',
    );
    expect(html).toContain(
      '<footer class="by-roll"><h2>By roll</h2><ul><li><a href="rolls/2026-005-BBBBBBBB.html">2026-005 Norway</a></li><li><a href="rolls/2026-004-AAAAAAAA.html">2026-004 Westfjords</a></li></ul></footer>',
    );
  });
});

describe('a roll’s or event’s page', () => {
  test('has its heading, its date and count, a way back to its cards, and its photos', () => {
    const html = file(
      [aPhoto('1', { event: iceland }), aPhoto('2', { event: iceland })],
      'events/iceland.html',
    );
    expect(html).toContain('<title>Iceland 2026 · Iceland highlights</title>');
    expect(html).toContain(
      '<p class="site-name"><a href="../index.html">Iceland highlights</a></p>',
    );
    expect(html).toContain(
      '<a class="back" href="../index.html">← All events</a>',
    );
    expect(html).toContain('<h1>Iceland 2026</h1>');
    expect(html).toContain('<p class="group-meta">Sep 2026 · 2 photos</p>');
    expect(html.match(/class="photo /g)).toHaveLength(2);
  });

  test('a roll’s page leads back to the home page too', () => {
    expect(file([aPhoto('1')], 'rolls/2026-004-AAAAAAAA.html')).toContain(
      '<a class="back" href="../index.html">← All events</a>',
    );
  });

  test('links each photo to its frame page and offers all sizes, from the folder above, with no caption or lightbox', () => {
    const html = file(
      [aPhoto('1', { details: { title: 'Black beach' } })],
      'rolls/2026-004-AAAAAAAA.html',
    );
    expect(html).toContain('<a href="2026-004-AAAAAAAA/1-F1.html">');
    expect(html).toContain(
      'srcset="../images/1-640.jpg 640w, ../images/1-1600.jpg 1600w"',
    );
    expect(html).toContain('alt="Frame 1"');
    expect(html).toContain('class="photo shape-14995"');
    expect(html).toContain('<link rel="stylesheet" href="../assets/site.css">');
    expect(html).not.toContain('<figcaption>');
    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('style=');
  });
});

describe('a frame’s page', () => {
  const three = [aPhoto('1'), aPhoto('2'), aPhoto('3')];
  const framePage = (
    name: string,
    photos: readonly SitePhoto[] = three,
    over: Partial<SiteOptions> = {},
  ) => file(photos, `rolls/2026-004-AAAAAAAA/${name}-F${name}.html`, over);

  test('has the site’s header, a way back to its roll or event, and its place', () => {
    const html = framePage('2');
    expect(html).toContain('<title>Frame 2 · Iceland highlights</title>');
    expect(html).toContain(
      '<p class="site-name"><a href="../../index.html">Iceland highlights</a></p>',
    );
    expect(html).toContain(
      '<a class="back" href="../2026-004-AAAAAAAA.html">← 2026-004 Westfjords</a>',
    );
    expect(html).toContain('<p class="place">2 of 3</p>');
  });

  test('shows the photo large, from the site’s sizes', () => {
    expect(framePage('2')).toContain(
      '<img src="../../images/2-1600.jpg" srcset="../../images/2-640.jpg 640w, ../../images/2-1600.jpg 1600w" sizes="100vw" width="1600" height="1067" alt="Frame 2">',
    );
  });

  test('steps to the previous and next frames, with neither past the ends', () => {
    const middle = framePage('2');
    expect(middle).toContain(
      '<a class="step previous" href="1-F1.html" aria-label="Previous frame">‹</a>',
    );
    expect(middle).toContain(
      '<a class="step next" href="3-F3.html" aria-label="Next frame">›</a>',
    );
    expect(framePage('1')).not.toContain('Previous frame');
    expect(framePage('3')).not.toContain('Next frame');
  });

  test('has a filmstrip of the roll’s frames, each a link, the one shown marked', () => {
    const html = framePage('2');
    const strip =
      /<nav class="filmstrip" aria-label="Filmstrip">(.*?)<\/nav>/s.exec(
        html,
      )?.[1] ?? '';
    expect(strip.match(/<a /g)).toHaveLength(3);
    expect(strip).toContain(
      '<a href="2-F2.html" aria-label="Frame 2" aria-current="page"><img src="../../images/2-640.jpg" alt="" loading="lazy"></a>',
    );
    expect(strip).toContain('<a href="1-F1.html" aria-label="Frame 1">');
  });

  test('writes the captions chosen under the photo, in a fixed order, and none when nothing chosen is known', () => {
    const photo = aPhoto('1', {
      details: { title: 'Black beach', shot: 'Sep 2026', camera: 'Leica M6' },
    });
    expect(
      framePage('1', [photo], { captions: ['camera', 'title'] }),
    ).toContain('<p class="caption">Black beach · Leica M6</p>');
    expect(
      framePage('1', [aPhoto('1', { details: {} })], {
        captions: ['title', 'camera'],
      }),
    ).not.toContain('class="caption"');
  });

  test('has the script that steps by key and swipe, from the folder two up', () => {
    expect(framePage('2')).toContain(
      '<script src="../../assets/site.js"></script>',
    );
  });

  test('a frame in an event has a page there too, stepping through the event', () => {
    const html = file(
      [aPhoto('1', { event: iceland }), aPhoto('2')],
      'events/iceland/1-F1.html',
    );
    expect(html).toContain(
      '<a class="back" href="../iceland.html">← Iceland 2026</a>',
    );
    expect(html).toContain('<p class="place">1 of 1</p>');
  });
});

test('sets a photo’s shape in the stylesheet, once for each shape', () => {
  const css = file(
    [aPhoto('1'), aPhoto('2'), aPhoto('3', { width: 1000, height: 1000 })],
    'assets/site.css',
  );
  expect(css).toContain('.shape-14995 {\n  --shape: 1.4995;\n}');
  expect(css).toContain('.shape-10000 {\n  --shape: 1;\n}');
  expect(css.match(/\.shape-14995 \{/g)).toHaveLength(1);
});

test('escapes every word that came from the archive', () => {
  const photo = aPhoto('1', {
    alt: '"><script>x</script>',
    roll: { ...westfjords, heading: '<i>Roll</i>' },
    details: { title: '<b>Bold</b>' },
  });
  const all = files([photo], { title: 'A & B' })
    .map((made) => made.content)
    .join('\n');
  expect(all).not.toContain('<script>x');
  expect(all).not.toContain('<b>Bold');
  expect(all).not.toContain('<i>Roll');
  expect(all).toContain('A &amp; B');
});
