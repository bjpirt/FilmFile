import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { ValidationFailed } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Slug } from '../../../domain/shared/slug.ts';
import type { EventRepository } from '../../ports/event-repository.ts';
import { knownEvent } from '../rolls/known-event.ts';

/** Every slug, if each is an event in the archive. */
export async function knownEvents(
  events: EventRepository,
  ctx: ArchiveContext,
  slugs: readonly string[],
): Promise<Result<readonly Slug[], ValidationFailed>> {
  const known: Slug[] = [];
  for (const slug of slugs) {
    const event = await knownEvent(events, ctx, slug);
    if (!event.ok) {
      return err({
        kind: 'validation-failed',
        issues: [
          {
            path: ['events'],
            message: `${slug} is not an event in the archive`,
          },
        ],
      });
    }
    known.push(event.value);
  }
  return ok(known);
}
