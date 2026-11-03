import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  camera,
  cameraList,
  createCameraRequest,
  createFilmStockRequest,
  createLensRequest,
  filmStock,
  filmStockList,
  lens,
  lensList,
} from '@filmfile/contracts/equipment';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import type { CreateCamera } from '../../../../application/use-cases/equipment/create-camera.ts';
import type { CreateFilmStock } from '../../../../application/use-cases/equipment/create-film-stock.ts';
import type { ListCameras } from '../../../../application/use-cases/equipment/list-cameras.ts';
import type { ListFilmStocks } from '../../../../application/use-cases/equipment/list-film-stocks.ts';
import type { CreateLens } from '../../../../application/use-cases/equipment/create-lens.ts';
import type { ListLenses } from '../../../../application/use-cases/equipment/list-lenses.ts';
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

const listFilmStocks = createRoute({
  method: 'get',
  path: '/films',
  summary: 'List the film stocks',
  responses: {
    200: json(filmStockList, 'Every film stock, ordered by make and name.'),
  },
});

const createFilmStock = createRoute({
  method: 'post',
  path: '/films',
  summary: 'Add a film stock',
  middleware: [requireContentType('application/json')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: createFilmStockRequest } },
    },
  },
  responses: {
    201: json(filmStock, 'The new film stock.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    409: json(errorResponse, 'A film stock with the same slug already exists.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
  },
});

const listLenses = createRoute({
  method: 'get',
  path: '/lenses',
  summary: 'List the lenses',
  responses: {
    200: json(
      lensList,
      'Every lens, ordered by make, name, focal length and aperture.',
    ),
  },
});

const createLens = createRoute({
  method: 'post',
  path: '/lenses',
  summary: 'Add a lens',
  middleware: [requireContentType('application/json')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: createLensRequest } },
    },
  },
  responses: {
    201: json(lens, 'The new lens.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    409: json(errorResponse, 'A lens with the same slug already exists.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
  },
});

export interface EquipmentUseCases {
  readonly listCameras: ListCameras;
  readonly createCamera: CreateCamera;
  readonly listFilmStocks: ListFilmStocks;
  readonly createFilmStock: CreateFilmStock;
  readonly listLenses: ListLenses;
  readonly createLens: CreateLens;
}

/** The archive's equipment: cameras, film stocks and lenses. */
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

  routes.openapi(listFilmStocks, async (c) => {
    const films = await useCases.listFilmStocks.execute(ctx);
    return c.json({ films: [...films] }, 200);
  });

  routes.openapi(createFilmStock, async (c) => {
    const created = await useCases.createFilmStock.execute(
      ctx,
      c.req.valid('json'),
    );
    return created.ok
      ? c.json(created.value, 201)
      : domainErrorResponse(c, created.error);
  });

  routes.openapi(listLenses, async (c) => {
    const lenses = await useCases.listLenses.execute(ctx);
    return c.json({ lenses: [...lenses] }, 200);
  });

  routes.openapi(createLens, async (c) => {
    const created = await useCases.createLens.execute(ctx, c.req.valid('json'));
    return created.ok
      ? c.json(created.value, 201)
      : domainErrorResponse(c, created.error);
  });

  return routes;
}
