import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  site as siteSchema,
  sitePublished,
  sitePublishProgress,
} from '@filmfile/contracts/sites';
import { FixedClock } from '../../src/adapters/outbound/memory/fixed-clock.ts';
import { InMemoryPublishBucket } from '../../src/adapters/outbound/memory/in-memory-publish-bucket.ts';
import type {
  BucketTarget,
  FileToPut,
} from '../../src/application/ports/publish-bucket.ts';
import type { PublishFailed } from '../../src/domain/shared/domain-error.ts';
import type { Result } from '../../src/domain/shared/result.ts';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();

const accountId = '0123456789abcdef0123456789abcdef';
const target = {
  bucket: 'photos-pirt',
  address: 'https://photos.example.com',
};
const bucketTarget: BucketTarget = { accountId, bucket: target.bucket };

/** A bucket that remembers the order files were put in, and can hold puts back. */
class WatchedBucket extends InMemoryPublishBucket {
  readonly puts: string[] = [];
  readonly removed: string[] = [];
  holding: Promise<void> | undefined;
  inFlight = 0;

  override async put(
    to: BucketTarget,
    file: FileToPut,
    signal: AbortSignal,
  ): Promise<Result<undefined, PublishFailed>> {
    this.puts.push(file.key);
    this.inFlight += 1;
    await this.holding;
    this.inFlight -= 1;
    return super.put(to, file, signal);
  }

  override deleteMany(
    to: BucketTarget,
    keys: readonly string[],
    signal: AbortSignal,
  ): Promise<Result<undefined, PublishFailed>> {
    this.removed.push(...keys);
    return super.deleteMany(to, keys, signal);
  }
}

function setUp(options: { readonly createBucket?: boolean } = {}) {
  const bucket = new WatchedBucket(new FixedClock('2026-11-13T14:02:00.000Z'));
  if (options.createBucket ?? true) {
    bucket.createBucket(bucketTarget);
  }
  const { request, post } = apiFor(archive, { publishBucket: bucket });

  const patch = async (slug: string, body: unknown) => {
    const read = await request(`/api/sites/${slug}`);
    const etag = read.headers.get('ETag') ?? '';
    return request(`/api/sites/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify(body),
    });
  };

  /** Sets FilmFile up, once, with the Cloudflare account (D119) unless asked not to. */
  let setUpDone = false;
  async function settingsWithAnAccount(withAccount = true) {
    if (!setUpDone) {
      await post('/api/settings', { author: 'Ben Pirt', copyright: 'Mine' });
      setUpDone = true;
    }
    if (withAccount) {
      const etag = (await request('/api/settings')).headers.get('ETag') ?? '';
      const saved = await request('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': etag },
        body: JSON.stringify({ cloudflareAccountId: accountId }),
      });
      expect(saved.status).toBe(200);
    }
  }

  async function aSiteWithATarget(withAccount = true): Promise<string> {
    await settingsWithAnAccount(withAccount);
    const created = await post('/api/sites', { name: 'Iceland' });
    expect(created.status).toBe(201);
    const slug = siteSchema.parse(await created.json()).slug;
    expect((await patch(slug, { publish: target })).status).toBe(200);
    return slug;
  }

  let shades = 0;
  async function aFrameWithAScan(rollId: string, number: string) {
    const frame = idOf(
      await (await post(`/api/rolls/${rollId}/frames`, { number })).json(),
    );
    shades += 30;
    const added = await request(
      `/api/rolls/${rollId}/frames/${String(frame)}/versions?file=scan-${number}.jpg`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: new Uint8Array(
          await aJpeg({ width: 900, height: 600, shade: shades }),
        ),
      },
    );
    expect(added.status).toBe(201);
    return String(frame);
  }

  async function aRollWithFrames(...numbers: string[]) {
    await settingsWithAnAccount(false);
    const roll = idOf(
      await (
        await post('/api/rolls', { roll: '2026-014', shot: '2026-09-12' })
      ).json(),
    );
    const frames = [];
    for (const number of numbers) {
      frames.push(await aFrameWithAScan(String(roll), number));
    }
    return { rollId: String(roll), frames };
  }

  const published = async (slug: string) =>
    request(`/api/sites/${slug}/published`);

  async function status(slug: string) {
    return sitePublished.parse(await (await published(slug)).json());
  }

  /** Waits for the publish running for the site to end. */
  async function untilPublishEnds(slug: string) {
    // Up to 30 seconds: building with sharp is slow when every test file runs at once.
    for (let tries = 0; tries < 1500; tries += 1) {
      const now = await status(slug);
      if (now.publish !== null && now.publish.state !== 'running') {
        return now.publish;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('the publish did not finish');
  }

  async function publishAndWait(slug: string) {
    const started = await post(`/api/sites/${slug}/publish`, {});
    expect(started.status).toBe(202);
    return untilPublishEnds(slug);
  }

  return {
    bucket,
    request,
    post,
    patch,
    aSiteWithATarget,
    aRollWithFrames,
    published,
    status,
    publishAndWait,
    untilPublishEnds,
  };
}

describe('a site’s publish target', () => {
  test('is saved with the site, given back with it, and taken away with null', async () => {
    const { request, patch, post } = setUp();
    const created = await post('/api/sites', { name: 'Iceland' });
    const made = siteSchema.parse(await created.json());
    const slug = made.slug;
    expect(made.publish).toBeNull();

    const saved = await patch(slug, { publish: target });
    expect(siteSchema.parse(await saved.json()).publish).toEqual(target);
    expect(
      siteSchema.parse(await (await request(`/api/sites/${slug}`)).json())
        .publish,
    ).toEqual(target);

    const cleared = await patch(slug, { publish: null });
    expect(siteSchema.parse(await cleared.json()).publish).toBeNull();
  });

  test('reads a site file written with an account ID past it, and drops it on the next save', async () => {
    const { request, patch, aSiteWithATarget } = setUp();
    const slug = await aSiteWithATarget();
    const file = path.join(archive.path(), 'sites', `${slug}.json`);
    const stored: unknown = JSON.parse(await readFile(file, 'utf8'));
    expect(stored).toMatchObject({ publish: target });
    await writeFile(
      file,
      `${JSON.stringify(
        {
          ...(typeof stored === 'object' ? stored : {}),
          publish: { accountId, ...target },
        },
        null,
        2,
      )}\n`,
    );

    const read = siteSchema.parse(
      await (await request(`/api/sites/${slug}`)).json(),
    );
    expect(read.publish).toEqual(target);
    await patch(slug, { name: 'Iceland' });
    expect(await readFile(file, 'utf8')).not.toContain('accountId');
  });

  test.each([
    ['a bucket name R2 would not take', { bucket: 'Photos_Pirt' }, 'bucket'],
    ['an address that is not https', { address: 'http://a.com' }, 'address'],
  ])('refuses %s, saving nothing', async (_name, change, field) => {
    const { request, patch, post } = setUp();
    const slug = siteSchema.parse(
      await (await post('/api/sites', { name: 'Iceland' })).json(),
    ).slug;

    const refused = await patch(slug, { publish: { ...target, ...change } });

    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({
      issues: [{ path: ['publish', field] }],
    });
    expect(
      siteSchema.parse(await (await request(`/api/sites/${slug}`)).json())
        .publish,
    ).toBeNull();
  });
});

describe('GET /api/sites/{slug}/published', () => {
  test('refuses a site with no publish target', async () => {
    const { post, published } = setUp();
    const slug = siteSchema.parse(
      await (await post('/api/sites', { name: 'Iceland' })).json(),
    ).slug;

    expect((await published(slug)).status).toBe(422);
  });

  test('says the site is not built while nothing is built', async () => {
    const { aSiteWithATarget, status } = setUp();
    const slug = await aSiteWithATarget();

    expect(await status(slug)).toMatchObject({
      stands: 'not-built',
      publishedAt: null,
      filesInBucket: 0,
      publish: null,
    });
  });

  test('says what to fix when the bucket cannot be used, and still tells how the latest publish went', async () => {
    const { aSiteWithATarget, status } = setUp({ createBucket: false });
    const slug = await aSiteWithATarget();

    expect(await status(slug)).toEqual({
      stands: 'unknown',
      check: {
        failure: 'no-bucket',
        message: "There's no bucket photos-pirt in that Cloudflare account.",
      },
      publishedAt: null,
      filesToUpdate: 0,
      filesInBucket: 0,
      publish: null,
    });
  });

  test('is 404 for a site that is not there', async () => {
    const { published } = setUp();

    expect((await published('nowhere')).status).toBe(404);
  });
});

describe('without a Cloudflare account in Settings', () => {
  test('says to set one, and refuses to publish or unpublish', async () => {
    const { request, post, aSiteWithATarget, status } = setUp();
    const slug = await aSiteWithATarget(false);
    const needsAccount = {
      error: 'invalid request',
      issues: [
        {
          path: ['cloudflareAccountId'],
          message: 'Set your Cloudflare account ID in Settings.',
        },
      ],
    };

    expect(await status(slug)).toMatchObject({
      stands: 'unknown',
      check: {
        failure: 'no-account',
        message: 'Set your Cloudflare account ID in Settings.',
      },
    });
    const publish = await post(`/api/sites/${slug}/publish`, {});
    expect(publish.status).toBe(422);
    expect(await publish.json()).toEqual(needsAccount);
    const unpublish = await request(`/api/sites/${slug}/published`, {
      method: 'DELETE',
    });
    expect(unpublish.status).toBe(422);
    expect(await unpublish.json()).toEqual(needsAccount);
  });
});

describe('POST /api/sites/{slug}/publish', () => {
  test('builds the site, uploads it with its types, and then says it is up to date', async () => {
    const {
      bucket,
      aSiteWithATarget,
      aRollWithFrames,
      publishAndWait,
      status,
    } = setUp();
    await aRollWithFrames('1', '2');
    const slug = await aSiteWithATarget();

    const progress = await publishAndWait(slug);

    expect(progress).toMatchObject({ state: 'done', failure: null });
    const keys = [...bucket.files(bucketTarget).keys()];
    expect(keys).toContain('index.html');
    expect(keys.some((key) => key.startsWith('images/'))).toBe(true);
    expect(keys).not.toContain('site.json');
    const index = bucket.files(bucketTarget).get('index.html');
    expect(index).toMatchObject({
      contentType: 'text/html; charset=utf-8',
      cacheControl: 'public, max-age=300',
    });
    const image = [...bucket.files(bucketTarget)].find(([key]) =>
      key.startsWith('images/'),
    )?.[1];
    expect(image).toMatchObject({
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    });
    expect(await status(slug)).toMatchObject({
      stands: 'up-to-date',
      publishedAt: '2026-11-13T14:02:00.000Z',
      filesToUpdate: 0,
      filesInBucket: keys.length,
    });
  });

  test('puts images before pages, CSS and script', async () => {
    const { bucket, aSiteWithATarget, aRollWithFrames, publishAndWait } =
      setUp();
    await aRollWithFrames('1');
    const slug = await aSiteWithATarget();

    await publishAndWait(slug);

    const lastImage = bucket.puts.findLastIndex((key) =>
      key.startsWith('images/'),
    );
    const firstOther = bucket.puts.findIndex(
      (key) => !key.startsWith('images/'),
    );
    expect(lastImage).toBeGreaterThanOrEqual(0);
    expect(lastImage).toBeLessThan(firstOther);
  });

  test('publishing again with nothing changed uploads and removes nothing', async () => {
    const { bucket, aSiteWithATarget, aRollWithFrames, publishAndWait } =
      setUp();
    await aRollWithFrames('1');
    const slug = await aSiteWithATarget();
    await publishAndWait(slug);
    const before = bucket.puts.length;

    const again = await publishAndWait(slug);

    expect(again.state).toBe('done');
    expect(bucket.puts.length).toBe(before);
    expect(bucket.removed).toEqual([]);
  });

  test('uploads only what changed, and removes what the site no longer has', async () => {
    const {
      bucket,
      request,
      aSiteWithATarget,
      aRollWithFrames,
      publishAndWait,
      status,
    } = setUp();
    const { rollId, frames } = await aRollWithFrames('1', '2');
    const slug = await aSiteWithATarget();
    await publishAndWait(slug);
    const imagesBefore = [...bucket.files(bucketTarget).keys()].filter((key) =>
      key.startsWith('images/'),
    );
    bucket.puts.length = 0;

    const etag =
      (await request(`/api/rolls/${rollId}`)).headers.get('ETag') ?? '';
    const gone = await request(
      `/api/rolls/${rollId}/frames/${String(frames[1])}`,
      { method: 'DELETE', headers: { 'If-Match': etag } },
    );
    expect(gone.status).toBe(204);
    await publishAndWait(slug);

    const imagesAfter = [...bucket.files(bucketTarget).keys()].filter((key) =>
      key.startsWith('images/'),
    );
    expect(imagesAfter.length).toBeLessThan(imagesBefore.length);
    expect(bucket.removed.length).toBeGreaterThan(0);
    expect(bucket.puts.every((key) => !key.startsWith('images/'))).toBe(true);
    expect((await status(slug)).stands).toBe('up-to-date');
  });

  test('says how many files need updating when the bucket differs from the built site', async () => {
    const {
      bucket,
      aSiteWithATarget,
      aRollWithFrames,
      publishAndWait,
      status,
    } = setUp();
    await aRollWithFrames('1');
    const slug = await aSiteWithATarget();
    await publishAndWait(slug);
    const signal = new AbortController().signal;
    const file = (key: string, text: string) => ({
      key,
      bytes: new TextEncoder().encode(text),
      contentType: 'text/html',
      cacheControl: 'x',
    });
    await bucket.put(bucketTarget, file('index.html', 'changed'), signal);
    await bucket.put(bucketTarget, file('stray.html', 'extra'), signal);

    expect(await status(slug)).toMatchObject({
      stands: 'needs-update',
      filesToUpdate: 2,
    });
  });

  test('says the site is not published while the bucket has no index.html', async () => {
    const {
      bucket,
      aSiteWithATarget,
      aRollWithFrames,
      publishAndWait,
      status,
    } = setUp();
    await aRollWithFrames('1');
    const slug = await aSiteWithATarget();
    await publishAndWait(slug);
    await bucket.deleteMany(
      bucketTarget,
      ['index.html'],
      new AbortController().signal,
    );

    expect(await status(slug)).toMatchObject({
      stands: 'not-published',
      publishedAt: null,
      filesToUpdate: 1,
    });
  });

  test('refuses a site with no publish target', async () => {
    const { post } = setUp();
    const slug = siteSchema.parse(
      await (await post('/api/sites', { name: 'Iceland' })).json(),
    ).slug;

    expect((await post(`/api/sites/${slug}/publish`, {})).status).toBe(422);
  });

  test.each([
    [
      'no-credentials',
      "No [filmfile] profile in ~/.aws/credentials, so the site can't be published.",
    ],
    ['keys-refused', 'Cloudflare refused the keys in the [filmfile] profile.'],
    ['unreachable', "Couldn't reach Cloudflare. Are you online?"],
    ['other', "Couldn't publish the site."],
  ] as const)('fails with what to fix for %s', async (reason, message) => {
    const { bucket, aSiteWithATarget, aRollWithFrames, publishAndWait } =
      setUp();
    await aRollWithFrames('1');
    const slug = await aSiteWithATarget();
    bucket.failWith(reason);

    const progress = await publishAndWait(slug);

    expect(progress).toMatchObject({
      state: 'failed',
      failure: reason,
      message,
    });
  });

  test('says there is no bucket when the account has none of that name', async () => {
    const { aSiteWithATarget, aRollWithFrames, publishAndWait } = setUp({
      createBucket: false,
    });
    await aRollWithFrames('1');
    const slug = await aSiteWithATarget();

    expect(await publishAndWait(slug)).toMatchObject({
      state: 'failed',
      failure: 'no-bucket',
      message: "There's no bucket photos-pirt in that Cloudflare account.",
    });
  });

  test('keeps what was uploaded when a publish fails part-way', async () => {
    const { bucket, aSiteWithATarget, aRollWithFrames, publishAndWait } =
      setUp();
    await aRollWithFrames('1');
    const slug = await aSiteWithATarget();
    bucket.createBucket(bucketTarget);
    await bucket.put(
      bucketTarget,
      {
        key: 'old.html',
        bytes: new TextEncoder().encode('old'),
        contentType: 'text/html',
        cacheControl: 'x',
      },
      new AbortController().signal,
    );
    const put = bucket.put.bind(bucket);
    let count = 0;
    bucket.put = (to, file, signal) => {
      count += 1;
      if (count > 2) {
        bucket.failWith('unreachable');
      }
      return put(to, file, signal);
    };

    const progress = await publishAndWait(slug);

    expect(progress.state).toBe('failed');
    expect(bucket.files(bucketTarget).has('old.html')).toBe(true);
  });
});

describe('stopping, and what cannot happen together', () => {
  async function aHeldPublish() {
    const world = setUp();
    await world.aRollWithFrames('1', '2', '3');
    const slug = await world.aSiteWithATarget();
    let release: () => void = () => undefined;
    world.bucket.holding = new Promise<void>((resolve) => {
      release = resolve;
    });
    expect((await world.post(`/api/sites/${slug}/publish`, {})).status).toBe(
      202,
    );
    for (
      let tries = 0;
      tries < 400 && world.bucket.puts.length === 0;
      tries += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(world.bucket.puts.length).toBeGreaterThan(0);
    return { ...world, slug, release };
  }

  test('a cancel starts no more files, lets those going finish and takes nothing back', async () => {
    const { bucket, request, slug, release, untilPublishEnds } =
      await aHeldPublish();
    const going = bucket.inFlight;

    const cancelled = await request(`/api/sites/${slug}/publish`, {
      method: 'DELETE',
    });
    release();
    const progress = await untilPublishEnds(slug);

    expect(cancelled.status).toBe(204);
    expect(progress.state).toBe('cancelled');
    expect(going).toBeLessThanOrEqual(4);
    expect(bucket.puts.length).toBe(going);
    expect(bucket.files(bucketTarget).size).toBe(going);
    expect(bucket.removed).toEqual([]);
  });

  test('a build, an unpublish and a second publish are handled while one is going', async () => {
    const { request, post, slug, release, untilPublishEnds } =
      await aHeldPublish();

    const build = await post(`/api/sites/${slug}/build`, {});
    const unpublish = await request(`/api/sites/${slug}/published`, {
      method: 'DELETE',
    });
    const again = await post(`/api/sites/${slug}/publish`, {});

    expect(build.status).toBe(409);
    expect(await build.json()).toEqual({
      error: 'the site is being published',
    });
    expect(unpublish.status).toBe(409);
    expect(again.status).toBe(202);
    expect(sitePublishProgress.parse(await again.json()).state).toBe('running');
    release();
    expect((await untilPublishEnds(slug)).state).toBe('done');
  });

  test('is 404 to cancel a publish that is not running', async () => {
    const { request, aSiteWithATarget } = setUp();
    const slug = await aSiteWithATarget();

    const response = await request(`/api/sites/${slug}/publish`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/sites/{slug}/published', () => {
  test('removes everything in the site’s bucket and nothing in another', async () => {
    const {
      bucket,
      request,
      aSiteWithATarget,
      aRollWithFrames,
      publishAndWait,
      status,
    } = setUp();
    await aRollWithFrames('1');
    const slug = await aSiteWithATarget();
    await publishAndWait(slug);
    const other = { accountId, bucket: 'someone-elses' };
    bucket.createBucket(other);
    await bucket.put(
      other,
      {
        key: 'keep.html',
        bytes: new TextEncoder().encode('x'),
        contentType: 'text/html',
        cacheControl: 'x',
      },
      new AbortController().signal,
    );

    const response = await request(`/api/sites/${slug}/published`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    expect(bucket.files(bucketTarget).size).toBe(0);
    expect(bucket.files(other).size).toBe(1);
    expect(await status(slug)).toMatchObject({
      stands: 'not-published',
      filesInBucket: 0,
    });
  });

  test('is refused, changing nothing, when nothing is published', async () => {
    const { request, aSiteWithATarget } = setUp();
    const slug = await aSiteWithATarget();

    const response = await request(`/api/sites/${slug}/published`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: [{ message: 'nothing is published' }],
    });
  });

  test('says what to fix when the bucket cannot be reached', async () => {
    const { bucket, request, aSiteWithATarget } = setUp();
    const slug = await aSiteWithATarget();
    bucket.failWith('unreachable');

    const response = await request(`/api/sites/${slug}/published`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ reason: 'unreachable' });
  });
});
