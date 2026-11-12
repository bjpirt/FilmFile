import { expect, test } from 'vitest';
import {
  describeSiteStatus,
  planSiteBuild,
  type SiteStatus,
} from './plan-site-build.ts';
import type { SiteManifest } from './site-manifest.ts';
import type { SiteOptions } from './site-options.ts';
import type { SitePhoto } from './site-photo.ts';
import { isFrameId, type FrameId } from '../shared/ids.ts';

const options: SiteOptions = {
  title: 'Iceland',
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

function aPhoto(name: string, hash = 'a', title = ''): SitePhoto {
  return {
    frame: frameId(name),
    alt: name,
    images: [{ src: `images/${name}-${hash}.jpg`, width: 640, madeFrom: hash }],
    width: 3,
    height: 2,
    rating: null,
    roll: { key: 'r', heading: 'Roll', file: 'r' },
    details: title === '' ? {} : { title },
  };
}

const built = (...photos: SitePhoto[]): SiteManifest => ({
  version: 1,
  options,
  photos,
});

test('a site never built is not built, and every image is to be made', () => {
  const plan = planSiteBuild(undefined, [aPhoto('1'), aPhoto('2')], options);
  expect(plan.status).toEqual({ state: 'not-built' });
  expect(plan.imagesToMake).toEqual(['images/1-a.jpg', 'images/2-a.jpg']);
  expect(plan.imagesToRemove).toEqual([]);
});

test('the same frames, words and options are up to date and need nothing made', () => {
  const photos = [aPhoto('1'), aPhoto('2')];
  const plan = planSiteBuild(built(...photos), photos, options);
  expect(plan).toEqual({
    status: { state: 'up-to-date' },
    imagesToMake: [],
    imagesToRemove: [],
  });
});

test('does not mistake the order of a photo’s fields for a change', () => {
  const photo = aPhoto('1', 'a', 'Beach');
  const shuffled: SitePhoto = {
    details: photo.details,
    roll: photo.roll,
    rating: photo.rating,
    height: photo.height,
    width: photo.width,
    images: photo.images,
    alt: photo.alt,
    frame: photo.frame,
  };
  expect(planSiteBuild(built(photo), [shuffled], options).status.state).toBe(
    'up-to-date',
  );
});

test('a frame added, one removed and one changed are named, and only the new image is made', () => {
  const plan = planSiteBuild(
    built(aPhoto('1'), aPhoto('2'), aPhoto('3')),
    [aPhoto('1'), aPhoto('3', 'b'), aPhoto('4')],
    options,
  );
  expect(plan.status).toEqual({
    state: 'out-of-date',
    changes: {
      added: [frameId('4')],
      removed: [frameId('2')],
      changed: [frameId('3')],
      reordered: false,
      optionsChanged: false,
    },
  });
  expect(plan.imagesToMake).toEqual(['images/3-b.jpg', 'images/4-a.jpg']);
  expect(plan.imagesToRemove).toEqual(['images/2-a.jpg', 'images/3-a.jpg']);
});

test('a caption word changing makes the site out of date without making an image', () => {
  const plan = planSiteBuild(
    built(aPhoto('1', 'a', 'Beach')),
    [aPhoto('1', 'a', 'Black beach')],
    options,
  );
  expect(plan.status.state).toBe('out-of-date');
  expect(plan.imagesToMake).toEqual([]);
});

test('the same frames in another order are out of date', () => {
  const plan = planSiteBuild(
    built(aPhoto('1'), aPhoto('2')),
    [aPhoto('2'), aPhoto('1')],
    options,
  );
  expect(describeSiteStatus(plan.status)).toBe('Out of date: order changed');
});

test('different options are out of date', () => {
  const photos = [aPhoto('1')];
  const plan = planSiteBuild(built(...photos), photos, {
    ...options,
    organiseBy: 'rolls',
  });
  expect(describeSiteStatus(plan.status)).toBe('Out of date: options changed');
});

test.each<[SiteStatus, string]>([
  [{ state: 'not-built' }, 'Not built yet'],
  [{ state: 'up-to-date' }, 'Up to date'],
  [
    {
      state: 'out-of-date',
      changes: {
        added: [frameId('1'), frameId('2'), frameId('3')],
        removed: [frameId('4')],
        changed: [frameId('5'), frameId('6')],
        reordered: false,
        optionsChanged: false,
      },
    },
    'Out of date: 3 frames added, 1 removed, 2 changed',
  ],
])('says %j as "%s"', (status, text) => {
  expect(describeSiteStatus(status)).toBe(text);
});
