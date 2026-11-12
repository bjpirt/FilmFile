import { z } from 'zod';
import { ulid } from './rolls.ts';
import { frameSelection } from './selections.ts';
import { slug } from './slug.ts';

// Request and response shapes for sites (D91): a name and a selection of frames.

export const sitePresentation = z
  .strictObject({
    groupBy: z.enum(['nothing', 'roll', 'event']).meta({
      description: 'What the photos are split under.',
    }),
    captions: z
      .array(z.enum(['title', 'shot', 'camera', 'lens', 'film']))
      .max(5)
      .meta({ description: 'Which details appear under each photo.' }),
  })
  .meta({ id: 'SitePresentation' });

export const site = z
  .object({
    id: ulid,
    slug: slug.meta({
      description: 'Made from the name; it changes when the name does.',
    }),
    name: z.string().meta({ example: 'Iceland highlights' }),
    selection: frameSelection,
    presentation: sitePresentation,
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
    presentation: sitePresentation.optional(),
  })
  .meta({
    id: 'UpdateSiteRequest',
    description:
      'The details to change. A detail left out stays as it is; a selection or presentation replaces the whole one.',
  });

export const siteBuildProgress = z
  .object({
    state: z.enum(['running', 'done', 'cancelled', 'failed']),
    done: z.number().int().meta({
      description: 'Images dealt with so far, made or brought across.',
    }),
    total: z.number().int(),
    photos: z.number().int().meta({ description: 'Photos on the built site.' }),
    leftOut: z.number().int().meta({
      description:
        'Frames left out: hidden, gone from the archive or with no scan.',
    }),
    imagesMade: z.number().int(),
    imagesUnchanged: z.number().int(),
  })
  .meta({ id: 'SiteBuildProgress' });

export const siteStatus = z
  .object({
    freshness: z.enum(['not-built', 'up-to-date', 'out-of-date', 'in-the-way']),
    message: z.string().meta({
      description:
        'In words: "Not built yet", "Up to date" or "Out of date: 3 frames added, 1 removed, 2 changed".',
    }),
    build: siteBuildProgress.nullable().meta({
      description:
        'How the latest build since the service started went, if there was one.',
    }),
  })
  .meta({ id: 'SiteStatus' });

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

export type SiteStatus = z.infer<typeof siteStatus>;
export type SiteBuildProgress = z.infer<typeof siteBuildProgress>;
