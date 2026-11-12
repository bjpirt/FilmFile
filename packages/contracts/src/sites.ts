import { z } from 'zod';
import { ulid } from './rolls.ts';
import { frameSelection } from './selections.ts';
import { slug } from './slug.ts';

// Request and response shapes for sites (D91): a name and a selection of frames.

export const site = z
  .object({
    id: ulid,
    slug: slug.meta({
      description: 'Made from the name; it changes when the name does.',
    }),
    name: z.string().meta({ example: 'Iceland highlights' }),
    selection: frameSelection,
  })
  .meta({ id: 'Site' });

export const siteSummary = z
  .object({
    slug,
    name: z.string(),
    frameCount: z.number().int().meta({
      description:
        'How many frames are on the site now, worked out from the archive.',
    }),
  })
  .meta({ id: 'SiteSummary' });

export const siteList = z
  .object({ sites: z.array(siteSummary) })
  .meta({ id: 'SiteList' });

export const createSiteRequest = z
  .strictObject({
    name: z.string().trim().min(1).max(100).meta({
      description:
        'What the site is called; its slug is made from it. A new site has every frame until rules are set.',
    }),
  })
  .meta({ id: 'CreateSiteRequest' });

export const updateSiteRequest = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional().meta({
      description: 'A new name, which changes the slug.',
    }),
    selection: frameSelection.optional(),
  })
  .meta({
    id: 'UpdateSiteRequest',
    description:
      'The details to change. A detail left out stays as it is; a selection replaces the whole one.',
  });

export const siteParams = z.object({ slug });

/** The site's version, from the ETag it was read with, so a changed site isn't overwritten. */
export const siteIfMatchHeader = z.object({
  'if-match': z
    .string()
    .optional()
    .meta({ description: "The site's ETag, from when it was read." }),
});

export type Site = z.infer<typeof site>;
export type SiteSummary = z.infer<typeof siteSummary>;
