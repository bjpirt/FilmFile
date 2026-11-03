import { z } from 'zod';
import { slug } from './slug.ts';

// Request and response shapes for equipment: cameras, film stocks and lenses.

export const camera = z
  .object({
    slug,
    make: z.string().meta({ example: 'Nikon' }),
    model: z.string().meta({ example: 'FE' }),
  })
  .meta({ id: 'Camera' });

export const cameraList = z
  .object({ cameras: z.array(camera) })
  .meta({ id: 'CameraList' });

export const createCameraRequest = z
  .object({
    make: z.string().min(1).max(50).meta({ example: 'Nikon' }),
    model: z.string().min(1).max(100).meta({ example: 'FE' }),
  })
  .meta({
    id: 'CreateCameraRequest',
    description: 'Its slug is made from its make and model.',
  });

export const filmType = z
  .enum(['black-and-white', 'colour-negative', 'colour-slide'])
  .meta({ description: 'What kind of picture the film gives.' });

export const filmFormat = z
  .enum(['35mm', '120', '220', '127', '110', '4x5', '8x10'])
  .meta({ description: 'The size of film.' });

export const filmStock = z
  .object({
    slug,
    make: z.string().meta({ example: 'Kodak' }),
    name: z.string().meta({ example: 'Portra 400' }),
    iso: z.number().int().nullable().meta({ example: 400 }),
    type: filmType.nullable(),
    format: filmFormat.nullable(),
  })
  .meta({ id: 'FilmStock' });

export const filmStockList = z
  .object({ films: z.array(filmStock) })
  .meta({ id: 'FilmStockList' });

export const createFilmStockRequest = z
  .object({
    make: z.string().min(1).max(50).meta({ example: 'Kodak' }),
    name: z.string().min(1).max(100).meta({ example: 'Portra 400' }),
    iso: z.number().int().min(1).max(100_000).nullable().optional(),
    type: filmType.nullable().optional(),
    format: filmFormat.nullable().optional(),
  })
  .meta({
    id: 'CreateFilmStockRequest',
    description: 'Its slug is made from its make and name.',
  });

export const lens = z
  .object({
    slug,
    make: z.string().meta({ example: 'Nikon' }),
    name: z.string().meta({ example: 'Nikkor AI-S' }),
    focalLength: z
      .number()
      .nullable()
      .meta({ description: 'In millimetres.', example: 50 }),
    maxAperture: z
      .number()
      .nullable()
      .meta({ description: 'The widest f-number.', example: 1.8 }),
  })
  .meta({ id: 'Lens' });

export const lensList = z
  .object({ lenses: z.array(lens) })
  .meta({ id: 'LensList' });

export const createLensRequest = z
  .object({
    make: z.string().min(1).max(50).meta({ example: 'Nikon' }),
    name: z.string().min(1).max(100).meta({ example: 'Nikkor AI-S' }),
    focalLength: z.number().positive().max(10_000).nullable().optional(),
    maxAperture: z.number().positive().max(1_000).nullable().optional(),
  })
  .meta({
    id: 'CreateLensRequest',
    description:
      'Its slug is made from its make, name, focal length and aperture.',
  });

export type Camera = z.infer<typeof camera>;
export type Lens = z.infer<typeof lens>;
export type FilmStock = z.infer<typeof filmStock>;
export type FilmType = z.infer<typeof filmType>;
export type FilmFormat = z.infer<typeof filmFormat>;
