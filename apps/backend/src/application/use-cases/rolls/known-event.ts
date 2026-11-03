import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { ValidationFailed } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { isSlug, type Slug } from '../../../domain/shared/slug.ts';
import type { EventRepository } from '../../ports/event-repository.ts';

/** The slug, if it's an event in the archive, so a roll never names one that isn't. */
export async function knownEvent(
  events: EventRepository,
  ctx: ArchiveContext,
  slug: string,
): Promise<Result<Slug, ValidationFailed>> {
  if (isSlug(slug) && (await events.get(ctx, slug))) {
    return ok(slug);
  }
  return err({
    kind: 'validation-failed',
    issues: [{ path: ['event'], message: 'is not an event in the archive' }],
  });
}
