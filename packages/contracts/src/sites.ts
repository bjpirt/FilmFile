import { z } from 'zod';
import { ulid } from './rolls.ts';
import { frameSelection } from './selections.ts';
import { slug } from './slug.ts';

// Request and response shapes for sites (D91): a name and a selection of frames.

export const sitePresentation = z
  .strictObject({
    title: z.string().max(200).meta({
      description:
        "The title the built site's pages show, apart from its name; blank for none (D108).",
    }),
    copyright: z.string().max(500).nullable().meta({
      description:
        "The copyright notice at the foot of every page; null takes the archive's from Settings, blank shows none (D108).",
    }),
    captions: z
      .array(z.enum(['title', 'shot', 'camera', 'lens', 'film']))
      .max(5)
      .meta({ description: 'Which details appear under each photo.' }),
  })
  .meta({ id: 'SitePresentation' });

export const publishTarget = z
  .strictObject({
    accountId: z.string().max(100).meta({
      description: 'The Cloudflare account ID: 32 hexadecimal characters.',
    }),
    bucket: z.string().max(100).meta({
      description:
        "The R2 bucket, used only for this site: what the site doesn't have is removed from it.",
    }),
    address: z.string().max(500).meta({
      description:
        'Where the published site is seen, an https:// address; only ever a link.',
    }),
  })
  .meta({ id: 'PublishTarget' });

export const site = z
  .object({
    id: ulid,
    slug: slug.meta({
      description: 'Made from the name; it changes when the name does.',
    }),
    name: z.string().meta({ example: 'Iceland highlights' }),
    selection: frameSelection,
    presentation: sitePresentation,
    publish: publishTarget.nullable().meta({
      description: 'Where the site is published, or null while it is not set.',
    }),
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
    publish: publishTarget.nullable().optional().meta({
      description:
        'Where to publish the site; null takes the target away. Every field is checked.',
    }),
  })
  .meta({
    id: 'UpdateSiteRequest',
    description:
      'The details to change. A detail left out stays as it is; a selection or presentation replaces the whole one.',
  });

export const siteBuildQuery = z.strictObject({
  rebuild: z.enum(['all', 'pages']).optional().meta({
    description:
      'Build it again even when it is up to date: all makes every image and page again (FF-191), pages writes every page again and keeps the images (FF-193).',
  }),
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

const publishFailureReason = z.enum([
  'no-credentials',
  'keys-refused',
  'no-bucket',
  'unreachable',
  'other',
]);

export const publishFailedResponse = z
  .object({
    error: z.string().meta({
      description:
        'What to fix, in words, such as "Cloudflare refused the keys in the [filmfile] profile."',
    }),
    reason: publishFailureReason,
  })
  .meta({ id: 'PublishFailedResponse' });

export const sitePublishProgress = z
  .object({
    state: z.enum(['running', 'done', 'cancelled', 'failed']),
    phase: z.enum(['building', 'uploading', 'removing']).meta({
      description:
        'What it is doing: building the site first, putting files in the bucket, or removing what the site no longer has.',
    }),
    done: z.number().int().meta({
      description:
        'Images (building) or files (uploading, removing) dealt with so far.',
    }),
    total: z.number().int(),
    failure: z
      .enum([
        'no-credentials',
        'keys-refused',
        'no-bucket',
        'unreachable',
        'other',
        'build-failed',
      ])
      .nullable()
      .meta({
        description:
          'Why it failed, if it did; build-failed when the site could not be built first.',
      }),
    message: z.string().nullable().meta({
      description: 'What to fix, in words, when it failed.',
    }),
  })
  .meta({ id: 'SitePublishProgress' });

export const sitePublished = z
  .object({
    stands: z
      .enum([
        'unknown',
        'not-built',
        'not-published',
        'up-to-date',
        'needs-update',
      ])
      .meta({
        description:
          'unknown: the bucket could not be asked, see check; not-built: there is nothing built to compare with; not-published: the bucket has no index.html; up-to-date; or needs-update.',
      }),
    check: z
      .object({ failure: publishFailureReason, message: z.string() })
      .nullable()
      .meta({
        description:
          'Why the bucket could not be asked, in words, when stands is unknown.',
      }),
    publishedAt: z.iso.datetime().nullable().meta({
      description: 'When index.html in the bucket was written.',
    }),
    filesToUpdate: z.number().int().meta({
      description:
        'Files to upload or remove to make the bucket the built site.',
    }),
    filesInBucket: z.number().int().meta({
      description: 'Files in the bucket now, which unpublishing would remove.',
    }),
    publish: sitePublishProgress.nullable().meta({
      description:
        'How the latest publish since the service started went, if there was one.',
    }),
  })
  .meta({ id: 'SitePublished' });

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
export type SitePublished = z.infer<typeof sitePublished>;
export type SitePublishProgress = z.infer<typeof sitePublishProgress>;
