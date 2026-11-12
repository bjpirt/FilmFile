import { z } from 'zod';
import type { Rule, Selection } from '../../../domain/selections/selection.ts';
import { assertNever } from '../../../domain/shared/assert-never.ts';
import {
  isFrameId,
  isRollId,
  isSiteId,
  type FrameId,
  type RollId,
  type SiteId,
} from '../../../domain/shared/ids.ts';
import { isSlug, type Slug } from '../../../domain/shared/slug.ts';
import { defaultPresentation, type Site } from '../../../domain/sites/site.ts';

// The persistence model for a site: Library/sites/<slug>.json. The slug is
// the file name, so the file holds only the rest. Frames are named by roll
// and frame ID (never by path), and a rule is its kind and its values.

const currentSchema = 1;

const slugValue = z.custom<Slug>(
  (value) => typeof value === 'string' && isSlug(value),
  'must be a slug',
);
const rollIdValue = z.custom<RollId>(
  (value) => typeof value === 'string' && isRollId(value),
  'must be a ULID',
);
const frameIdValue = z.custom<FrameId>(
  (value) => typeof value === 'string' && isFrameId(value),
  'must be a ULID',
);
const limitDate = z
  .string()
  .regex(
    /^\d{4}(-\d{2}(-\d{2})?)?$/,
    'must be like 2026, 2026-09 or 2026-09-14',
  );

const storedRule = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rating'),
    atLeast: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
  }),
  z.object({ kind: z.literal('event'), events: z.array(slugValue) }),
  z.object({ kind: z.literal('roll'), rolls: z.array(rollIdValue) }),
  z.object({ kind: z.literal('camera'), cameras: z.array(slugValue) }),
  z.object({ kind: z.literal('lens'), lenses: z.array(slugValue) }),
  z.object({ kind: z.literal('film'), films: z.array(slugValue) }),
  z.object({ kind: z.literal('shot-after'), date: limitDate }),
  z.object({ kind: z.literal('shot-before'), date: limitDate }),
  z.object({ kind: z.literal('has'), version: z.enum(['final', 'raw-scan']) }),
]);

const storedFrame = z.object({ roll: rollIdValue, frame: frameIdValue });

const storedPresentation = z.object({
  // Older files had `groupBy` instead (D104); not migrated, they read as Both.
  organiseBy: z.enum(['events', 'rolls', 'both']).default('both'),
  captions: z.array(z.enum(['title', 'shot', 'camera', 'lens', 'film'])),
});

const storedSite = z.object({
  schema: z.literal(currentSchema),
  id: z.custom<SiteId>(
    (value) => typeof value === 'string' && isSiteId(value),
    'must be a ULID',
  ),
  name: z.string().min(1),
  selection: z.object({
    rules: z.array(storedRule),
    // Older files had `pinned` and `hidden` instead (D103); they aren't
    // migrated, but default to nothing excluded so such a site still opens.
    excluded: z.array(storedFrame).default([]),
  }),
  // Only stored once it differs from the plain default, so older files read as plain.
  presentation: storedPresentation.optional(),
});

type SiteDetails = Omit<Site, 'slug'>;

/** The site's details in a site file's text; throws if the file isn't one. */
export function parseSiteFile(text: string): SiteDetails {
  const { id, name, selection, presentation } = storedSite.parse(
    JSON.parse(text),
  );
  return {
    id,
    name,
    selection: {
      rules: selection.rules,
      excluded: selection.excluded.map(({ roll, frame }) => ({
        rollId: roll,
        frameId: frame,
      })),
    },
    presentation: presentation ?? defaultPresentation,
  };
}

/** A rule as stored, its keys in a fixed order. */
function storedRuleOf(rule: Rule): z.input<typeof storedRule> {
  switch (rule.kind) {
    case 'rating':
      return { kind: 'rating', atLeast: rule.atLeast };
    case 'event':
      return { kind: 'event', events: [...rule.events] };
    case 'roll':
      return { kind: 'roll', rolls: [...rule.rolls] };
    case 'camera':
      return { kind: 'camera', cameras: [...rule.cameras] };
    case 'lens':
      return { kind: 'lens', lenses: [...rule.lenses] };
    case 'film':
      return { kind: 'film', films: [...rule.films] };
    case 'shot-after':
      return { kind: 'shot-after', date: rule.date };
    case 'shot-before':
      return { kind: 'shot-before', date: rule.date };
    case 'has':
      return { kind: 'has', version: rule.version };
    default:
      return assertNever(rule);
  }
}

function storedFramesOf(
  list: Selection['excluded'],
): z.input<typeof storedFrame>[] {
  return list.map(({ rollId, frameId }) => ({ roll: rollId, frame: frameId }));
}

const isDefault = (presentation: SiteDetails['presentation']): boolean =>
  JSON.stringify(presentation) === JSON.stringify(defaultPresentation);

/** A site as file text: keys in a fixed order, two-space indent, trailing newline. */
export function siteFileContent(site: SiteDetails): string {
  const stored: z.input<typeof storedSite> = {
    schema: currentSchema,
    id: site.id,
    name: site.name,
    selection: {
      rules: site.selection.rules.map(storedRuleOf),
      excluded: storedFramesOf(site.selection.excluded),
    },
    ...(isDefault(site.presentation)
      ? {}
      : {
          presentation: {
            organiseBy: site.presentation.organiseBy,
            captions: [...site.presentation.captions],
          },
        }),
  };
  return `${JSON.stringify(stored, null, 2)}\n`;
}
