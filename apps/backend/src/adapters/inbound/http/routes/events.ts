import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import {
  createEventRequest,
  event,
  eventIfMatchHeader,
  eventList,
  eventParams,
  updateEventRequest,
} from '@filmfile/contracts/events';
import type { CreateEvent } from '../../../../application/use-cases/events/create-event.ts';
import type { GetEvent } from '../../../../application/use-cases/events/get-event.ts';
import type { ListEvents } from '../../../../application/use-cases/events/list-events.ts';
import type { UpdateEvent } from '../../../../application/use-cases/events/update-event.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { isSlug } from '../../../../domain/shared/slug.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { etagOf, versionFrom } from '../etag.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';

function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

const requireJson = requireContentType('application/json');

const listEvents = createRoute({
  method: 'get',
  path: '/',
  summary: 'List the events',
  responses: {
    200: json(eventList, 'Every event, newest first; undated events last.'),
  },
});

const createEvent = createRoute({
  method: 'post',
  path: '/',
  summary: 'Add an event',
  middleware: [requireJson] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: createEventRequest } },
    },
  },
  responses: {
    201: json(event, 'The new event.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    409: json(errorResponse, 'An event with the same slug already exists.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
  },
});

const getEvent = createRoute({
  method: 'get',
  path: '/{slug}',
  summary: 'Get an event',
  description: "The response's ETag is the event's version, for If-Match.",
  request: { params: eventParams },
  responses: {
    200: json(event, 'The event.'),
    404: json(errorResponse, 'There is no event with that slug.'),
    422: json(invalidRequestResponse, 'The slug is not a slug.'),
  },
});

const updateEvent = createRoute({
  method: 'patch',
  path: '/{slug}',
  summary: "Change an event's name or date",
  description:
    "Send the event's ETag as If-Match: the change is refused if the event has changed since. The response's ETag is the event's new version.",
  middleware: [requireJson] as const,
  request: {
    params: eventParams,
    headers: eventIfMatchHeader,
    body: {
      required: true,
      content: { 'application/json': { schema: updateEventRequest } },
    },
  },
  responses: {
    200: json(event, 'The updated event.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    404: json(errorResponse, 'There is no event with that slug.'),
    409: json(errorResponse, 'The event has changed since it was read.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
    428: json(errorResponse, 'If-Match is missing.'),
  },
});

export interface EventUseCases {
  readonly listEvents: ListEvents;
  readonly createEvent: CreateEvent;
  readonly getEvent: GetEvent;
  readonly updateEvent: UpdateEvent;
}

/**
 * The archive's events. The route schemas have already checked slugs; the
 * type guard below only gives them their branded type.
 */
export function eventRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: EventUseCases;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });
  const notFound = { error: 'not found' };

  routes.openapi(listEvents, async (c) => {
    const events = await useCases.listEvents.execute(ctx);
    return c.json({ events: [...events] }, 200);
  });

  routes.openapi(createEvent, async (c) => {
    const created = await useCases.createEvent.execute(
      ctx,
      c.req.valid('json'),
    );
    return created.ok
      ? c.json(created.value, 201)
      : domainErrorResponse(c, created.error);
  });

  routes.openapi(getEvent, async (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const found = await useCases.getEvent.execute(ctx, { slug });
    if (!found.ok) {
      return domainErrorResponse(c, found.error);
    }
    c.header('ETag', etagOf(found.value.version));
    return c.json(found.value.event, 200);
  });

  routes.openapi(updateEvent, async (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the event’s ETag as If-Match' }, 428);
    }
    const updated = await useCases.updateEvent.execute(ctx, {
      slug,
      expectedVersion: versionFrom(ifMatch),
      ...c.req.valid('json'),
    });
    if (!updated.ok) {
      return domainErrorResponse(c, updated.error);
    }
    c.header('ETag', etagOf(updated.value.version));
    return c.json(updated.value.event, 200);
  });

  return routes;
}
