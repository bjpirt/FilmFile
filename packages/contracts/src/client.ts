import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './api-types.ts';

/** A fetch client for the FilmFile API, typed from its OpenAPI spec. */
export function createApiClient(options: ClientOptions = {}) {
  return createClient<paths>(options);
}

export type ApiClient = ReturnType<typeof createApiClient>;
