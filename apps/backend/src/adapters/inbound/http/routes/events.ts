import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import {
  createEventRequest,
  event,
  eventList,
} from '@filmfile/contracts/events';
import type { CreateEvent } from '../../../../application/use-cases/events/create-event.ts';
import type { ListEvents } from '../../../../application/use-cases/events/list-events.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';

function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

const listEvents = createRoute({
  method: 'get',
  path: '/',
  summary: 'List the events',
  responses: {
    200: json(eventList, 'Every event, ordered by name.'),
  },
});

const createEvent = createRoute({
  method: 'post',
  path: '/',
  summary: 'Add an event',
  middleware: [requireContentType('application/json')] as const,
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

export interface EventUseCases {
  readonly listEvents: ListEvents;
  readonly createEvent: CreateEvent;
}

/** The archive's events. */
export function eventRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: EventUseCases;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });

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

  return routes;
}
