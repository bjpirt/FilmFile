import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  camera,
  cameraList,
  createCameraRequest,
} from '@filmfile/contracts/equipment';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import type { CreateCamera } from '../../../../application/use-cases/equipment/create-camera.ts';
import type { ListCameras } from '../../../../application/use-cases/equipment/list-cameras.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';

function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

const listCameras = createRoute({
  method: 'get',
  path: '/cameras',
  summary: 'List the cameras',
  responses: {
    200: json(cameraList, 'Every camera, ordered by name.'),
  },
});

const createCamera = createRoute({
  method: 'post',
  path: '/cameras',
  summary: 'Add a camera',
  middleware: [requireContentType('application/json')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: createCameraRequest } },
    },
  },
  responses: {
    201: json(camera, 'The new camera.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    409: json(errorResponse, 'A camera with the same slug already exists.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
  },
});

export interface EquipmentUseCases {
  readonly listCameras: ListCameras;
  readonly createCamera: CreateCamera;
}

/** The archive's equipment: cameras so far. */
export function equipmentRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: EquipmentUseCases;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });

  routes.openapi(listCameras, async (c) => {
    const cameras = await useCases.listCameras.execute(ctx);
    return c.json({ cameras: [...cameras] }, 200);
  });

  routes.openapi(createCamera, async (c) => {
    const created = await useCases.createCamera.execute(
      ctx,
      c.req.valid('json'),
    );
    return created.ok
      ? c.json(created.value, 201)
      : domainErrorResponse(c, created.error);
  });

  return routes;
}
