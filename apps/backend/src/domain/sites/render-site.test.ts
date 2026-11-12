import { describe, expect, test } from 'vitest';
import { renderSite } from './render-site.ts';
import { noPhotosText } from './render-cards-page.ts';
import type { SiteOptions } from './site-options.ts';
import type { GroupLabel, SitePhoto } from './site-photo.ts';
import { isFrameId, type FrameId } from '../shared/ids.ts';

const options: SiteOptions = {
  title: 'Iceland highlights',
  organiseBy: 'both',
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
  test('with Both: the event cards as the index, the roll cards, a page for each event and roll, and the assets', () => {
    const photos = [
      aPhoto('1', { event: iceland }),
      aPhoto('2', { roll: norway }),
    ];
    expect(files(photos).map((made) => made.path)).toEqual([
      'index.html',
      'rolls.html',
      'events/iceland.html',
      'events/_no-event.html',
      'rolls/2026-005-BBBBBBBB.html',
      'rolls/2026-004-AAAAAAAA.html',
      'assets/site.css',
      'assets/site.js',
    ]);
  });

  test('with Rolls alone: the roll cards as the index, and a page for each roll', () => {
    expect(
      files([aPhoto('1', { event: iceland })], { organiseBy: 'rolls' }).map(
        (made) => made.path,
      ),
    ).toEqual([
      'index.html',
      'rolls/2026-004-AAAAAAAA.html',
      'assets/site.css',
      'assets/site.js',
    ]);
  });

  test('with Events alone: the event cards as the index, and a page for each event', () => {
    expect(
      files([aPhoto('1', { event: iceland })], { organiseBy: 'events' }).map(
        (made) => made.path,
      ),
    ).toEqual([
      'index.html',
      'events/iceland.html',
      'assets/site.css',
      'assets/site.js',
    ]);
  });

  test('with no photos, the cards pages say so and there are no other pages', () => {
    expect(files([]).map((made) => made.path)).toEqual([
      'index.html',
      'rolls.html',
      'assets/site.css',
      'assets/site.js',
    ]);
    expect(file([], 'index.html')).toContain(noPhotosText);
    expect(file([], 'rolls.html')).toContain(noPhotosText);
  });

  test('makes byte-identical files from the same inputs', () => {
    expect(files([aPhoto('1')])).toEqual(files([aPhoto('1')]));
  });

  test('uses only relative links, so it works from any folder', () => {
    for (const made of files([aPhoto('1', { event: iceland })])) {
      expect(made.content).not.toMatch(/(?:href|src)="(?:\/|https?:)/);
    }
  });
});

describe('the cards', () => {
  test('names the site, as its heading and title, on the index', () => {
    const html = file([aPhoto('1')], 'index.html');
    expect(html).toContain('<title>Iceland highlights</title>');
    expect(html).toContain(
      '<h1 class="site-name"><a href="index.html">Iceland highlights</a></h1>',
    );
  });

  test('a card leads to its page and shows its name, its count and its date', () => {
    const html = file(
      [aPhoto('1', { event: iceland }), aPhoto('2', { event: iceland })],
      'index.html',
    );
    expect(html).toContain('<a href="events/iceland.html">');
    expect(html).toContain('<h2>Iceland 2026</h2>');
    expect(html).toContain('<p>2 photos · Sep 2026</p>');
  });

  test('a roll’s card is dated by its first frame, and one photo is "1 photo"', () => {
    const html = file(
      [aPhoto('1', { details: { shot: '3 Mar 2026' } })],
      'rolls.html',
    );
    expect(html).toContain('<h2>2026-004 Westfjords</h2>');
    expect(html).toContain('<p>1 photo · 3 Mar 2026</p>');
  });

  test('shows its three highest rated photos, then the earliest, with empty places for fewer', () => {
    const html = file(
      [
        aPhoto('1', { rating: 2 }),
        aPhoto('2', { rating: 5 }),
        aPhoto('3'),
        aPhoto('4', { rating: 4 }),
        aPhoto('5', { rating: 2 }),
      ],
      'rolls.html',
    );
    const peek = /<div class="peek"[^>]*>(.*?)<\/div>/s.exec(html)?.[1] ?? '';
    expect(
      [...peek.matchAll(/src="images\/(\d)-640\.jpg"/g)].map((m) => m[1]),
    ).toEqual(['2', '4', '1']);

    const few = file([aPhoto('1')], 'rolls.html');
    expect(few.match(/class="peek-empty"/g)).toHaveLength(2);
  });

  test('puts the newest first, by the latest frame in each, undated last', () => {
    const html = file(
      [
        aPhoto('1', { roll: westfjords }),
        aPhoto('2', { roll: norway }),
        aPhoto('3', { roll: westfjords }),
        aPhoto('4', {
          roll: { key: 'r3', heading: '2026-006', file: '2026-006-C' },
          details: {},
        }),
      ],
      'rolls.html',
    );
    const order = [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((m) => m[1]);
    expect(order).toEqual([
      '2026-004 Westfjords',
      '2026-005 Norway',
      '2026-006',
    ]);
  });

  test('frames in no event are on a "No event set" card, last', () => {
    const html = file(
      [aPhoto('1'), aPhoto('2', { event: iceland })],
      'index.html',
    );
    const order = [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((m) => m[1]);
    expect(order).toEqual(['Iceland 2026', 'No event set']);
    expect(html).toContain('<a href="events/_no-event.html">');
  });

  test('with Both, every page has an "Events | Rolls" menu, the view shown marked', () => {
    const photos = [aPhoto('1', { event: iceland })];
    expect(file(photos, 'index.html')).toContain(
      '<nav class="views" aria-label="View by"><a href="index.html" aria-current="page">Events</a><a href="rolls.html">Rolls</a></nav>',
    );
    expect(file(photos, 'rolls.html')).toContain(
      '<a href="index.html">Events</a><a href="rolls.html" aria-current="page">Rolls</a>',
    );
    expect(file(photos, 'rolls/2026-004-AAAAAAAA.html')).toContain(
      '<a href="../index.html">Events</a><a href="../rolls.html" aria-current="page">Rolls</a>',
    );
  });

  test('with one view there is no menu', () => {
    expect(
      file([aPhoto('1')], 'index.html', { organiseBy: 'rolls' }),
    ).not.toContain('class="views"');
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

  test('a roll’s page leads back to the roll cards, or to the index when it is them', () => {
    expect(file([aPhoto('1')], 'rolls/2026-004-AAAAAAAA.html')).toContain(
      '<a class="back" href="../rolls.html">← All rolls</a>',
    );
    expect(
      file([aPhoto('1')], 'rolls/2026-004-AAAAAAAA.html', {
        organiseBy: 'rolls',
      }),
    ).toContain('<a class="back" href="../index.html">← All rolls</a>');
  });

  test('links each photo to its widest image and offers all sizes, from the folder above', () => {
    const html = file([aPhoto('1')], 'rolls/2026-004-AAAAAAAA.html');
    expect(html).toContain('<a href="../images/1-1600.jpg">');
    expect(html).toContain(
      'srcset="../images/1-640.jpg 640w, ../images/1-1600.jpg 1600w"',
    );
    expect(html).toContain('alt="Frame 1"');
    expect(html).toContain('class="photo shape-14995"');
    expect(html).toContain('<link rel="stylesheet" href="../assets/site.css">');
    expect(html).toContain('<script src="../assets/site.js"></script>');
    expect(html).not.toContain('style=');
  });

  test('writes the captions chosen, in a fixed order, and none when nothing chosen is known', () => {
    const photo = aPhoto('1', {
      details: { title: 'Black beach', shot: 'Sep 2026', camera: 'Leica M6' },
    });
    expect(
      file([photo], 'rolls/2026-004-AAAAAAAA.html', {
        captions: ['camera', 'title'],
      }),
    ).toContain('<figcaption>Black beach · Leica M6</figcaption>');
    expect(
      file([aPhoto('2')], 'rolls/2026-004-AAAAAAAA.html', {
        captions: ['title'],
      }),
    ).not.toContain('<figcaption>');
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
