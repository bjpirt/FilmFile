import { createApiClient, type ApiClient } from '@filmfile/contracts/client';
import {
  createCameraRequest,
  createFilmStockRequest,
  createLensRequest,
  type Camera,
  type FilmStock,
  type Lens,
} from '@filmfile/contracts/equipment';
import {
  createEventRequest,
  updateEventRequest,
  type Event,
} from '@filmfile/contracts/events';
import {
  createFrameRequest,
  createRollRequest,
  updateFrameNumbersRequest,
  updateFrameRequest,
  updateRollRequest,
  type Frame,
  type Roll,
  type UnreadableRoll,
} from '@filmfile/contracts/rolls';
import { cameraLabel } from '../equipment/use-cameras.ts';
import { filmStockLabel } from '../equipment/use-film-stocks.ts';
import { lensLabel } from '../equipment/use-lenses.ts';

// A stand-in for the backend in the web app's tests: it answers the API the
// way the service does, keeping an archive in memory, so a page can be tested
// against behaviour rather than canned replies. Tests arrange the archive,
// act through the page, and assert on what the page shows or on the archive.

/** What the archive starts with; everything else starts empty. */
export interface ArchiveContents {
  readonly rolls?: readonly Roll[];
  readonly unreadable?: readonly UnreadableRoll[];
  readonly cameras?: readonly Camera[];
  readonly films?: readonly FilmStock[];
  readonly lenses?: readonly Lens[];
  readonly events?: readonly Event[];
}

/** A roll with no details or frames, its ID made from its number: 2026-014 → 01JC8Z7K3M0000000002026014. */
export function aRoll(roll: string, details: Partial<Roll> = {}): Roll {
  return {
    id: `01JC8Z7K3M000000000${roll.replace('-', '')}`,
    roll,
    name: null,
    description: null,
    shot: null,
    event: null,
    camera: null,
    film: null,
    lens: null,
    frames: [],
    ...details,
  };
}

/** A frame with one scan of the given file name, e.g. aFrame('1', '12340001.jpg'). */
export function aFrame(number: string | null, file: string): Frame {
  const n = file.slice(4, 8);
  return {
    id: `01JC8Z7K3M00000000000F${n}`,
    number,
    versions: [
      {
        id: `01JC8Z7K3M00000000000V${n}`,
        file: `frames/x/y/${file}`,
        sha256: file,
        bytes: 3,
        width: 3,
        height: 2,
        added: '2026-11-02T12:00:00.000Z',
      },
    ],
  };
}

/** A slug made from a name as the service makes it: "Nikon FE" → `nikon-fe`. */
function slugFor(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

function notFound(): Response {
  return Response.json({ error: 'not found' }, { status: 404 });
}

/** A contract schema, as far as parsing a request body needs. */
interface Schema<T> {
  safeParse(value: unknown):
    | { readonly success: true; readonly data: T }
    | {
        readonly success: false;
        readonly error: {
          readonly issues: readonly {
            readonly path: readonly PropertyKey[];
            readonly message: string;
          }[];
        };
      };
}

/** The request's JSON body parsed with a contract schema, or the 422 the service would send. */
async function bodyOf<T>(
  request: Request,
  schema: Schema<T>,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const parsed = schema.safeParse(await request.json());
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return {
    ok: false,
    response: Response.json(
      {
        error: 'invalid request',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
        })),
      },
      { status: 422 },
    ),
  };
}

export function fakeArchive(contents: ArchiveContents = {}) {
  const rolls: Roll[] = (contents.rolls ?? []).map((roll) => ({
    ...roll,
    frames: [...roll.frames],
  }));
  const unreadable = [...(contents.unreadable ?? [])];
  const cameras = [...(contents.cameras ?? [])];
  const films = [...(contents.films ?? [])];
  const lenses = [...(contents.lenses ?? [])];
  const events = [...(contents.events ?? [])];
  /** Every request, as "METHOD /path?query". */
  const requests: string[] = [];
  /** The If-Match header of every PATCH, in order. */
  const ifMatches: (string | null)[] = [];
  /** The body of every request to create a roll. */
  const created: unknown[] = [];
  /** The file name of every scan uploaded. */
  const uploads: string[] = [];
  // Each roll's and event's version, sent as its ETag: "v1", then up by one per change.
  const versions = new Map<string, number>();
  let nextId = 0;
  let stopped = false;
  let savesFail = false;

  const newId = () => {
    nextId += 1;
    return `01JC8Z7K3M${String(nextId).padStart(16, '0')}`;
  };
  const etagOf = (key: string) => `"v${String(versions.get(key) ?? 1)}"`;
  const change = (key: string) => {
    versions.set(key, (versions.get(key) ?? 1) + 1);
  };

  /** Whether a PATCH may go ahead; if not, the 428 or 409 the service would send. */
  function checkIfMatch(request: Request, key: string): Response | undefined {
    const ifMatch = request.headers.get('If-Match');
    ifMatches.push(ifMatch);
    if (ifMatch === null) {
      return Response.json({ error: 'no If-Match' }, { status: 428 });
    }
    return ifMatch === etagOf(key)
      ? undefined
      : Response.json({ error: 'changed' }, { status: 409 });
  }

  /** A new camera, film stock, lens or event, unless its slug is taken. */
  function added<T extends { readonly slug: string }>(
    list: T[],
    item: T,
  ): Response {
    if (list.some((existing) => existing.slug === item.slug)) {
      return Response.json(
        { error: `${item.slug} already exists` },
        { status: 409 },
      );
    }
    list.push(item);
    return Response.json(item, { status: 201 });
  }

  async function equipment(request: Request, kind: string): Promise<Response> {
    switch (kind) {
      case 'cameras': {
        if (request.method === 'GET') {
          return Response.json({ cameras });
        }
        const body = await bodyOf(request, createCameraRequest);
        return body.ok
          ? added(cameras, {
              slug: slugFor(cameraLabel(body.value)),
              ...body.value,
            })
          : body.response;
      }
      case 'films': {
        if (request.method === 'GET') {
          return Response.json({ films });
        }
        const body = await bodyOf(request, createFilmStockRequest);
        if (!body.ok) {
          return body.response;
        }
        const details = {
          make: body.value.make,
          name: body.value.name,
          iso: body.value.iso ?? null,
          type: body.value.type ?? null,
          format: body.value.format ?? null,
        };
        return added(films, {
          slug: slugFor(filmStockLabel(details)),
          ...details,
        });
      }
      case 'lenses': {
        if (request.method === 'GET') {
          return Response.json({ lenses });
        }
        const body = await bodyOf(request, createLensRequest);
        if (!body.ok) {
          return body.response;
        }
        const details = {
          make: body.value.make,
          name: body.value.name,
          focalLength: body.value.focalLength ?? null,
          maxAperture: body.value.maxAperture ?? null,
        };
        return added(lenses, { slug: slugFor(lensLabel(details)), ...details });
      }
      default:
        return notFound();
    }
  }

  async function eventsRoute(
    request: Request,
    slug: string | undefined,
  ): Promise<Response> {
    if (slug === undefined) {
      if (request.method === 'GET') {
        // Newest first, undated last, as the service lists them.
        const listed = [...events].sort((a, b) =>
          a.date === b.date
            ? 0
            : a.date === null
              ? 1
              : b.date === null
                ? -1
                : b.date.localeCompare(a.date),
        );
        return Response.json({ events: listed });
      }
      const body = await bodyOf(request, createEventRequest);
      return body.ok
        ? added(events, {
            slug: slugFor(body.value.name),
            name: body.value.name,
            date: body.value.date ?? null,
          })
        : body.response;
    }
    const index = events.findIndex((event) => event.slug === slug);
    const current = events[index];
    if (current === undefined) {
      return notFound();
    }
    const key = `event:${slug}`;
    if (request.method === 'GET') {
      return Response.json(current, { headers: { ETag: etagOf(key) } });
    }
    const refused = checkIfMatch(request, key);
    if (refused !== undefined) {
      return refused;
    }
    const body = await bodyOf(request, updateEventRequest);
    if (!body.ok) {
      return body.response;
    }
    const updated = {
      ...current,
      ...(body.value.name === undefined ? {} : { name: body.value.name }),
      ...(body.value.date === undefined ? {} : { date: body.value.date }),
    };
    events[index] = updated;
    change(key);
    return Response.json(updated, { headers: { ETag: etagOf(key) } });
  }

  async function createRoll(request: Request): Promise<Response> {
    const body = await bodyOf(request, createRollRequest);
    if (!body.ok) {
      return body.response;
    }
    created.push(body.value);
    if (rolls.some((roll) => roll.roll === body.value.roll)) {
      return Response.json(
        { error: `roll ${body.value.roll} already exists` },
        { status: 409 },
      );
    }
    const roll: Roll = {
      id: newId(),
      roll: body.value.roll,
      name: body.value.name ?? null,
      description: body.value.description ?? null,
      shot: body.value.shot ?? null,
      event: body.value.event ?? null,
      camera: body.value.camera ?? null,
      film: body.value.film ?? null,
      lens: body.value.lens ?? null,
      frames: [],
    };
    rolls.push(roll);
    return Response.json(roll, { status: 201 });
  }

  async function rollRoute(
    request: Request,
    roll: Roll,
    rest: readonly string[],
    url: URL,
  ): Promise<Response> {
    const [frames, frameId, versions] = rest;
    if (frames === undefined) {
      if (request.method === 'GET') {
        return Response.json(roll, { headers: { ETag: etagOf(roll.id) } });
      }
      const refused = checkIfMatch(request, roll.id);
      if (refused !== undefined) {
        return refused;
      }
      const body = await bodyOf(request, updateRollRequest);
      if (!body.ok) {
        return body.response;
      }
      // A detail left out stays as it is.
      const changes = Object.fromEntries(
        Object.entries(body.value).filter(([, value]) => value !== undefined),
      );
      Object.assign(roll, changes);
      change(roll.id);
      return Response.json(roll, { headers: { ETag: etagOf(roll.id) } });
    }
    if (frameId === undefined) {
      if (request.method === 'POST') {
        const body = await bodyOf(request, createFrameRequest);
        if (!body.ok) {
          return body.response;
        }
        const frame: Frame = {
          id: newId(),
          number: body.value.number ?? null,
          versions: [],
        };
        roll.frames.push(frame);
        change(roll.id);
        return Response.json(frame, { status: 201 });
      }
      const refused = checkIfMatch(request, roll.id);
      if (refused !== undefined) {
        return refused;
      }
      const body = await bodyOf(request, updateFrameNumbersRequest);
      if (!body.ok) {
        return body.response;
      }
      for (const { frameId: id, number } of body.value.numbers) {
        roll.frames = roll.frames.map((frame) =>
          frame.id === id ? { ...frame, number } : frame,
        );
      }
      change(roll.id);
      return Response.json(roll, { headers: { ETag: etagOf(roll.id) } });
    }
    const frame = roll.frames.find((f) => f.id === frameId);
    if (frame === undefined) {
      return notFound();
    }
    if (versions === undefined) {
      const refused = checkIfMatch(request, roll.id);
      if (refused !== undefined) {
        return refused;
      }
      const body = await bodyOf(request, updateFrameRequest);
      if (!body.ok) {
        return body.response;
      }
      const updated = { ...frame, number: body.value.number };
      roll.frames = roll.frames.map((f) => (f.id === frameId ? updated : f));
      change(roll.id);
      return Response.json(updated, { headers: { ETag: etagOf(roll.id) } });
    }
    const hash = await sha256(await request.arrayBuffer());
    const holder = roll.frames.find((f) =>
      f.versions.some((version) => version.sha256 === hash),
    );
    if (holder !== undefined) {
      return Response.json(
        { error: 'this scan is already in the roll', frameId: holder.id },
        { status: 409 },
      );
    }
    const file = url.searchParams.get('file') ?? '';
    uploads.push(file);
    const version = {
      id: newId(),
      file: `frames/x/y/${file}`,
      sha256: hash,
      bytes: 3,
      width: 3,
      height: 2,
      added: '2026-11-02T12:00:00.000Z',
    };
    roll.frames = roll.frames.map((f) =>
      f.id === frameId ? { ...f, versions: [...f.versions, version] } : f,
    );
    change(roll.id);
    return Response.json(version, { status: 201 });
  }

  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (stopped) {
      return new Response('', { status: 502 });
    }
    if (savesFail && request.method === 'PATCH') {
      return new Response('', { status: 500 });
    }
    const [, api, resource, ...rest] = url.pathname.split('/');
    if (api !== 'api') {
      return notFound();
    }
    switch (resource ?? '') {
      case 'equipment':
        return equipment(request, rest[0] ?? '');
      case 'events':
        return eventsRoute(request, rest[0]);
      case 'rolls': {
        if (rest.length === 0) {
          return request.method === 'GET'
            ? Response.json({ rolls, unreadable })
            : createRoll(request);
        }
        const [rollId, ...below] = rest;
        const roll = rolls.find((r) => r.id === rollId);
        return roll === undefined
          ? notFound()
          : rollRoute(request, roll, below, url);
      }
      default:
        return notFound();
    }
  }

  const api: ApiClient = createApiClient({
    baseUrl: 'http://localhost',
    fetch: answer,
  });

  return {
    api,
    answer,
    rolls,
    cameras,
    films,
    lenses,
    events,
    requests,
    ifMatches,
    created,
    uploads,
    /** Stops answering, as a stopped service behind a proxy would: every request gets a 502. */
    stop() {
      stopped = true;
    },
    /** Refuses every change with a 500, as a broken service would; reading still works. */
    failSaves() {
      savesFail = true;
    },
    /** Changes a roll elsewhere, as another tab would, so the page's version is stale. */
    changeRoll(id: string) {
      change(id);
    },
    /** Changes an event elsewhere, as another tab would. */
    changeEvent(slug: string) {
      change(`event:${slug}`);
    },
    /** How many times a path was fetched with GET, e.g. `/api/equipment/cameras`. */
    gets(path: string): number {
      return requests.filter((r) => r === `GET ${path}`).length;
    },
  };
}

export type FakeArchive = ReturnType<typeof fakeArchive>;
