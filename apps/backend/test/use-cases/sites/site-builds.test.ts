import { expect, test } from 'vitest';
import { InMemoryBlobStore } from '../../../src/adapters/outbound/memory/in-memory-blob-store.ts';
import { InMemoryEquipmentRepository } from '../../../src/adapters/outbound/memory/in-memory-equipment-repository.ts';
import { InMemoryErrorReporter } from '../../../src/adapters/outbound/memory/in-memory-error-reporter.ts';
import { InMemoryEventRepository } from '../../../src/adapters/outbound/memory/in-memory-event-repository.ts';
import { InMemoryImageRenderer } from '../../../src/adapters/outbound/memory/in-memory-image-renderer.ts';
import { InMemoryRollRepository } from '../../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { InMemorySettingsRepository } from '../../../src/adapters/outbound/memory/in-memory-settings-repository.ts';
import { InMemorySiteFolders } from '../../../src/adapters/outbound/memory/in-memory-site-folders.ts';
import { InMemorySiteRepository } from '../../../src/adapters/outbound/memory/in-memory-site-repository.ts';
import { SearchFrames } from '../../../src/application/use-cases/selections/search-frames.ts';
import {
  BuildSite,
  type BuiltSite,
  type BuildSiteError,
} from '../../../src/application/use-cases/sites/build-site.ts';
import { SiteBuilds } from '../../../src/application/use-cases/sites/site-builds.ts';
import { isSiteId } from '../../../src/domain/shared/ids.ts';
import { ok, type Result } from '../../../src/domain/shared/result.ts';
import { isSlug } from '../../../src/domain/shared/slug.ts';
import type { SiteStatus } from '../../../src/domain/sites/plan-site-build.ts';
import { defaultPresentation } from '../../../src/domain/sites/site.ts';
import { ctx } from '../../support/builders.ts';
import { checked } from '../../support/checked.ts';

const slug = checked('iceland', isSlug);

/**
 * A build of a site never built, whose build waits until the test ends it,
 * and whose status check can be held, so the test can say which ends first.
 */
class HeldBuild extends BuildSite {
  readonly #buildEnds = Promise.withResolvers<undefined>();
  #statusHeld: Promise<undefined> | undefined;
  #statusAsked: (() => void) | undefined;

  constructor() {
    super(
      new InMemoryRollRepository(),
      new InMemorySettingsRepository(),
      new InMemoryEquipmentRepository(),
      new InMemoryEventRepository(),
      new InMemoryBlobStore(),
      new InMemoryImageRenderer(),
      new InMemorySiteFolders(),
    );
  }

  /** Holds the next status check; gives when it's asked, and its release. */
  holdStatus(): {
    readonly asked: Promise<undefined>;
    readonly release: () => void;
  } {
    const held = Promise.withResolvers<undefined>();
    const asked = Promise.withResolvers<undefined>();
    this.#statusHeld = held.promise;
    this.#statusAsked = () => {
      asked.resolve(undefined);
    };
    return {
      asked: asked.promise,
      release: () => {
        held.resolve(undefined);
      },
    };
  }

  endBuild(): void {
    this.#buildEnds.resolve(undefined);
  }

  override async status(): Promise<SiteStatus> {
    this.#statusAsked?.();
    await this.#statusHeld;
    return { state: 'not-built' };
  }

  override async execute(): Promise<Result<BuiltSite, BuildSiteError>> {
    await this.#buildEnds.promise;
    return ok({ photos: 0, leftOut: 0, imagesMade: 0, imagesUnchanged: 0 });
  }
}

test('never says a build is done alongside how the site stood before it ended', async () => {
  const sites = new InMemorySiteRepository();
  await sites.create(ctx, {
    id: checked('01JD8M2KZXQ4T6V8W0Y1A3C5E7', isSiteId),
    slug,
    name: 'Iceland',
    selection: { rules: [], excluded: [] },
    presentation: defaultPresentation,
  });
  const rolls = new InMemoryRollRepository();
  const settings = new InMemorySettingsRepository();
  const building = new HeldBuild();
  const builds = new SiteBuilds(
    sites,
    new SearchFrames(rolls, settings, new InMemoryEventRepository()),
    building,
    settings,
    new InMemoryErrorReporter(),
  );
  await builds.start(ctx, { slug });

  // Asked how the site stands while it's built; the build ends before the answer.
  const held = building.holdStatus();
  const status = builds.status(ctx, { slug });
  await held.asked;
  building.endBuild();
  await new Promise((resolve) => setTimeout(resolve, 0));
  held.release();
  const answer = await status;

  // Seen as still running, the page asks again and learns the site is built.
  expect(answer.ok && answer.value).toMatchObject({
    freshness: 'not-built',
    build: { state: 'running' },
  });
});
