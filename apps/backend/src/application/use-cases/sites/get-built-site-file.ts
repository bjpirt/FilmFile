import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { Slug } from '../../../domain/shared/slug.ts';
import type { SiteFolders } from '../../ports/site-folders.ts';

/** A file of a built site and what it is. */
export interface BuiltSiteFile {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

const contentTypes: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  jpg: 'image/jpeg',
};

/**
 * The cards pages, a roll's or event's page, or a file in `assets/` or
 * `images/` (D104), with names that can't climb out of them.
 */
const served =
  /^(?:index\.html|rolls\.html|(?:rolls|events)\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.html|(?:assets|images)\/[A-Za-z0-9_-][A-Za-z0-9._-]*)$/;

/**
 * A file of a built site, to open the site in the browser (FF-120). Only what
 * a build makes for showing is given (its pages, assets and images, D104):
 * never its `site.json`, and never anything else in `Sites/`.
 */
export class GetBuiltSiteFile {
  readonly #folders: SiteFolders;

  constructor(folders: SiteFolders) {
    this.#folders = folders;
  }

  async execute(
    ctx: ArchiveContext,
    input: { readonly slug: Slug; readonly path: string },
  ): Promise<Result<BuiltSiteFile, NotFound>> {
    const path = input.path === '' ? 'index.html' : input.path;
    const notFound = err({
      kind: 'not-found',
      entity: 'site',
      id: input.slug,
    } as const);
    if (!served.test(path)) {
      return notFound;
    }
    const bytes = await this.#folders.read(ctx, input.slug, path);
    const contentType = contentTypes[path.split('.').at(-1) ?? ''];
    return bytes === undefined || contentType === undefined
      ? notFound
      : ok({ bytes, contentType });
  }
}
