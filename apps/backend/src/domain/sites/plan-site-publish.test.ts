import { describe, expect, test } from 'vitest';
import { planSitePublish } from './plan-site-publish.ts';

const file = (path: string, md5 = 'a', size = 1) => ({ path, size, md5 });
const there = (key: string, md5 = 'a', size = 1) => ({ key, size, md5 });

describe('planSitePublish', () => {
  test('uploads everything to an empty bucket, images first', () => {
    const plan = planSitePublish({
      built: [
        file('index.html'),
        file('images/b.jpg'),
        file('assets/site.css'),
        file('images/a.jpg'),
      ],
      bucket: [],
    });
    expect(plan.uploads.map((f) => f.path)).toEqual([
      'images/a.jpg',
      'images/b.jpg',
      'assets/site.css',
      'index.html',
    ]);
    expect(plan.removals).toEqual([]);
  });

  test('does nothing when the bucket matches', () => {
    const plan = planSitePublish({
      built: [file('index.html'), file('images/a.jpg', 'b', 5)],
      bucket: [there('index.html'), there('images/a.jpg', 'b', 5)],
    });
    expect(plan).toEqual({ uploads: [], removals: [] });
  });

  test('uploads a file whose MD5 or size differs', () => {
    const plan = planSitePublish({
      built: [file('a.html', 'x'), file('b.html', 'a', 2), file('c.html')],
      bucket: [there('a.html', 'y'), there('b.html', 'a', 1), there('c.html')],
    });
    expect(plan.uploads.map((f) => f.path)).toEqual(['a.html', 'b.html']);
  });

  test('removes what the site no longer has, by key', () => {
    const plan = planSitePublish({
      built: [file('index.html')],
      bucket: [there('index.html'), there('old/z.html'), there('images/q.jpg')],
    });
    expect(plan.removals).toEqual(['images/q.jpg', 'old/z.html']);
  });

  test('never uploads site.json, and removes one found in the bucket', () => {
    const plan = planSitePublish({
      built: [file('index.html'), file('site.json')],
      bucket: [there('index.html'), there('site.json')],
    });
    expect(plan).toEqual({ uploads: [], removals: ['site.json'] });
  });
});
