import { describe, expect, test } from 'vitest';
import { renderSite } from './render-site.ts';
import { noPhotosText } from './render-home-page.ts';
import type { SiteOptions } from './site-options.ts';
import type { GroupLabel, SitePhoto } from './site-photo.ts';
import { isFrameId, type FrameId } from '../shared/ids.ts';

const options: SiteOptions = {
  title: 'Iceland highlights',
  copyright: '',
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
  test('the home page, a page for each event and for each frame in it, and the assets', () => {
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

  test('frames in no event are "Other <year> photos", after that year’s events, leading to their own page', () => {
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
      { year: '2026', cards: ['Lake District', 'Other 2026 photos'] },
      { year: '2025', cards: ['Cornwall', 'Other 2025 photos'] },
    ]);
    expect(html).toContain(
      '<a href="events/_no-event-2026.html"><img class="cover" src="images/3-640.jpg"',
    );
    expect(html).toContain('<h3>Other 2025 photos</h3><p>1 photo</p>');
    expect(html).toContain(
      '<p class="site-count">2 events · 4 photographs</p>',
    );
  });

  test('a year’s other photos have their own page, and each its frame page there', () => {
    const photos = [aPhoto('1'), aPhoto('2')];
    const page = file(photos, 'events/_no-event-2026.html');
    expect(page).toContain('<h1>Other 2026 photos</h1>');
    expect(page).toContain('<a href="_no-event-2026/1-F1.html">');
    expect(file(photos, 'events/_no-event-2026/2-F2.html')).toContain(
      '<a class="back" href="../_no-event-2026.html">← Other 2026 photos</a>',
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

  test('never mentions a roll: no list of rolls, no roll pages, no roll’s name (D107)', () => {
    const made = files([
      aPhoto('1', { roll: westfjords, event: iceland }),
      aPhoto('2', { roll: norway }),
    ]);
    for (const { path, content } of made) {
      expect(path).not.toMatch(/^rolls/);
      expect(content).not.toContain('Westfjords');
      expect(content).not.toContain('Norway');
      expect(content).not.toContain('By roll');
    }
  });
});

describe('an event’s page', () => {
  test('has the site’s header with "All events", its title block, and its photos', () => {
    const html = file(
      [aPhoto('1', { event: iceland }), aPhoto('2', { event: iceland })],
      'events/iceland.html',
    );
    expect(html).toContain('<title>Iceland 2026 · Iceland highlights</title>');
    expect(html).toContain(
      '<p class="site-name"><a href="../index.html">Iceland highlights</a></p><a class="all-events" href="../index.html">All events</a></header>',
    );
    expect(html).toContain(
      '<div class="title-block"><h1>Iceland 2026</h1><p class="group-meta">Sep 2026 · 2 photos</p></div>',
    );
    expect(html).not.toContain('class="back"');
    expect(html.match(/class="photo /g)).toHaveLength(2);
  });

  test('ends with the newer and earlier events, in the home page’s order, each leading to its page', () => {
    const photos = [
      aPhoto('1', { event: cornwall, details: { shot: 'Aug 2025' } }),
      aPhoto('2', { event: lake, details: { shot: '14 Jul 2026' } }),
      aPhoto('3'),
      aPhoto('4', { event: iceland }),
    ];
    expect(file(photos, 'events/lake.html')).toContain(
      '<nav class="neighbours" aria-label="Other events"><a class="newer" href="iceland.html"><span>Newer</span> ← Iceland 2026</a><a class="earlier" href="_no-event-2026.html"><span>Earlier</span> Other 2026 photos →</a></nav>',
    );
  });

  test('the newest event has no Newer, and the oldest no Earlier', () => {
    const photos = [
      aPhoto('1', { event: cornwall, details: { shot: 'Aug 2025' } }),
      aPhoto('2', { event: iceland }),
    ];
    const newest = file(photos, 'events/iceland.html');
    expect(newest).not.toContain('class="newer"');
    expect(newest).toContain('<a class="earlier" href="cornwall.html">');
    const oldest = file(photos, 'events/cornwall.html');
    expect(oldest).toContain('<a class="newer" href="iceland.html">');
    expect(oldest).not.toContain('class="earlier"');
    expect(
      file([aPhoto('1', { event: iceland })], 'events/iceland.html'),
    ).not.toContain('class="neighbours"');
  });

  test('an event with no date is dated by its first frame, and other photos by nothing but their count', () => {
    expect(
      file(
        [aPhoto('1', { event: noDate, details: { shot: 'May 2019' } })],
        'events/iceland.html',
      ),
    ).toContain('<p class="group-meta">May 2019 · 1 photo</p>');
    expect(file([aPhoto('1')], 'events/_no-event-2026.html')).toContain(
      '<p class="group-meta">1 photo</p>',
    );
  });

  test('links each photo to its frame page and offers all sizes, from the folder above, with no caption or lightbox', () => {
    const html = file(
      [aPhoto('1', { details: { title: 'Black beach', shot: '12 Sep 2026' } })],
      'events/_no-event-2026.html',
    );
    expect(html).toContain('<a href="_no-event-2026/1-F1.html">');
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
  ) => file(photos, `events/_no-event-2026/${name}-F${name}.html`, over);

  test('has the site’s header, a way back to its event, and its place', () => {
    const html = framePage('2');
    expect(html).toContain('<title>Frame 2 · Iceland highlights</title>');
    expect(html).toContain(
      '<p class="site-name"><a href="../../index.html">Iceland highlights</a></p>',
    );
    expect(html).toContain(
      '<a class="back" href="../_no-event-2026.html">← Other 2026 photos</a>',
    );
    expect(html).toContain('<p class="place">2 / 3</p>');
    expect(html).toContain(
      '<a class="all-events" href="../../index.html">All events</a>',
    );
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

  test('has a filmstrip of the event’s frames, each a link, the one shown marked', () => {
    const html = framePage('2');
    const strip =
      /<nav class="filmstrip" aria-label="Filmstrip">(.*?)<\/nav>/s.exec(
        html,
      )?.[1] ?? '';
    expect(strip.match(/<a /g)).toHaveLength(3);
    expect(strip).toContain(
      '<a href="2-F2.html" aria-label="Frame 2" aria-current="page"><img src="../../images/2-640.jpg" width="1600" height="1067" alt="" loading="lazy"></a>',
    );
    expect(strip).toContain('<a href="1-F1.html" aria-label="Frame 1">');
  });

  test('puts the filmstrip above the photo, under the bar (FF-190)', () => {
    const html = framePage('2');
    const bar = html.indexOf('class="frame-bar"');
    const strip = html.indexOf('class="filmstrip"');
    const stage = html.indexOf('class="frame-stage"');
    expect(bar).toBeLessThan(strip);
    expect(strip).toBeLessThan(stage);
  });

  test('writes the title in bold, with the date shot, under the photo, only when it has a title and Title is ticked', () => {
    const photo = aPhoto('1', {
      details: { title: 'Black beach', shot: 'Sep 2026', camera: 'Leica M6' },
    });
    expect(
      framePage('1', [photo], { captions: ['shot', 'title', 'camera'] }),
    ).toContain(
      '<p class="caption"><strong>Black beach</strong> <span>· Sep 2026</span></p>',
    );
    expect(framePage('1', [photo], { captions: ['title'] })).toContain(
      '<p class="caption"><strong>Black beach</strong></p>',
    );
    expect(
      framePage('1', [photo], { captions: ['shot', 'camera'] }),
    ).not.toContain('class="caption"');
    expect(
      framePage('1', [aPhoto('1', { details: { shot: '12 Sep 2026' } })], {
        captions: ['title', 'shot'],
      }),
    ).not.toContain('class="caption"');
  });

  test('shows the other details chosen under it, always, each a label and its value', () => {
    const photo = aPhoto('1', {
      details: {
        shot: '12 Sep 2026',
        camera: 'Leica M6',
        lens: 'Summicron 50',
        film: 'Portra 400',
      },
    });
    const html = framePage('1', [photo], {
      captions: ['film', 'camera', 'lens'],
    });
    expect(html).toContain(
      '<dl class="frame-details"><div><dt>Camera</dt><dd>Leica M6</dd></div><div><dt>Lens</dt><dd>Summicron 50</dd></div><div><dt>Film stock</dt><dd>Portra 400</dd></div></dl>',
    );
    expect(html).not.toContain('hidden');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('noscript');
  });

  test('with no title, the date shot is the first of the details', () => {
    const html = framePage(
      '1',
      [aPhoto('1', { details: { shot: '12 Sep 2026', camera: 'Leica M6' } })],
      { captions: ['title', 'shot', 'camera'] },
    );
    expect(html).toContain(
      '<dl class="frame-details"><div><dt>Date shot</dt><dd>12 Sep 2026</dd></div><div><dt>Camera</dt><dd>Leica M6</dd></div></dl>',
    );
  });

  test('keeps the caption and details with the photo, in one figure, as wide as the photo, and none when nothing is known', () => {
    const html = framePage(
      '1',
      [
        aPhoto('1', {
          details: {
            title: 'Black beach',
            shot: '12 Sep 2026',
            camera: 'Leica M6',
          },
        }),
      ],
      { captions: ['title', 'camera'] },
    );
    expect(html).toMatch(
      /<figure class="frame-figure"><div class="frame-photo"><img [^>]*><\/div><figcaption class="frame-info"><p class="caption"><strong>Black beach<\/strong><\/p><dl class="frame-details">.*<\/dl><\/figcaption><\/figure>/,
    );
    expect(
      framePage('1', [aPhoto('1', { details: { shot: '12 Sep 2026' } })]),
    ).toMatch(
      /<figure class="frame-figure"><div class="frame-photo"><img [^>]*><\/div><\/figure>/,
    );
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
    expect(html).toContain('<p class="place">1 / 1</p>');
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

describe('the title and copyright notice (D108)', () => {
  const photos = [aPhoto('1', { event: iceland })];
  const pages = [
    'index.html',
    'events/iceland.html',
    'events/iceland/1-F1.html',
  ];

  test('with no title, no page names the site, and the tabs show the page’s own name', () => {
    const blank = { title: '' };
    for (const page of pages) {
      expect(file(photos, page, blank)).not.toContain('class="site-name"');
    }
    expect(file(photos, 'index.html', blank)).toContain(
      '<title>Photographs</title>',
    );
    expect(file(photos, 'events/iceland.html', blank)).toContain(
      '<title>Iceland 2026</title>',
    );
    expect(file(photos, 'events/iceland/1-F1.html', blank)).toContain(
      '<title>Frame 1</title>',
    );
  });

  test('every page ends with the copyright notice, and none when it’s blank', () => {
    for (const page of pages) {
      expect(
        file(photos, page, { copyright: '© Ben Pirt. All rights reserved.' }),
      ).toContain(
        '<footer class="site-foot"><p>© Ben Pirt. All rights reserved.</p></footer>',
      );
      expect(file(photos, page)).not.toContain('site-foot');
    }
  });

  test('escapes the copyright notice', () => {
    expect(file(photos, 'index.html', { copyright: '<b>© Me</b>' })).toContain(
      '<p>&lt;b&gt;© Me&lt;/b&gt;</p>',
    );
  });
});
