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
  renumberRollsRequest,
  updateFrameRequest,
  updateFramesRequest,
  updateRollRequest,
  updateVersionRequest,
  type Frame,
  type FrameDetails,
  type Roll,
  type UnreadableRoll,
  type Version,
} from '@filmfile/contracts/rolls';
import {
  folderExportRequest,
  quickExportRequest,
} from '@filmfile/contracts/exports';
import { frameSelection } from '@filmfile/contracts/selections';
import {
  createSiteRequest,
  updateSiteRequest,
  type Site,
} from '@filmfile/contracts/sites';
import {
  createSettingsRequest,
  updateSettingsRequest,
  type Settings,
} from '@filmfile/contracts/settings';
import { cameraLabel } from '../equipment/use-cameras.ts';
import { filmStockLabel } from '../equipment/use-film-stocks.ts';
import { lensLabel } from '../equipment/use-lenses.ts';
import {
  compareRollNumbers,
  rollNumbersAreUnique,
  sameRollNumber,
} from '../rolls/roll-number.ts';
import {
  defaultRollNumberPattern,
  parseRollNumberPattern,
  patternOf,
  suggestRollNumber,
  whatIsMissing,
} from '../rolls/roll-number-pattern.ts';

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
  /** Sites, plainly presented unless they say how. */
  readonly sites?: readonly (Omit<Site, 'presentation'> & {
    readonly presentation?: Site['presentation'];
  })[];
  /** FilmFile's settings; set up by default, or null if they aren't yet. */
  readonly settings?: Settings | null;
  /** Whether the service can export into a folder the desktop app chooses (D100). */
  readonly exportToFolder?: boolean;
  /** What a folder export's status says as it's asked after, one after another; the last is kept. */
  readonly folderExportStates?: readonly {
    readonly state: 'running' | 'done' | 'cancelled' | 'failed';
    readonly done: number;
    readonly written: number;
    readonly leftOut?: number;
  }[];
  /** How each site starts out: not built, unless said. */
  readonly siteStatuses?: Readonly<
    Record<
      string,
      {
        readonly freshness:
          'not-built' | 'up-to-date' | 'out-of-date' | 'in-the-way';
        readonly message: string;
      }
    >
  >;
  /** What a build's progress says as it's asked after, one after another; the last is kept. */
  readonly siteBuildStates?: readonly {
    readonly state: 'running' | 'done' | 'cancelled' | 'failed';
    readonly done: number;
    readonly total: number;
  }[];
  /** Whether the person cancels the folder chooser. */
  readonly folderChooserCancelled?: boolean;
}

/** Settings that have been set up, as every page but first-run setup expects. */
export const setUpSettings: Settings = {
  id: '01JC8Y0000000000000000000A',
  author: 'Test author',
  copyright: null,
  rollNumberPattern: '{year}-{n:3}',
  folder: '/Users/test/Pictures/FilmFile',
};

/** A roll with no details or frames, its ID made from its number: 2026-014 → 01JC8Z7K3M0000000002026014. */
export function aRoll(roll: string, details: Partial<Roll> = {}): Roll {
  return {
    id: `01JC8Z7K3M000000000${roll.replace('-', '')}`,
    roll,
    filed: false,
    name: null,
    notes: null,
    shot: null,
    event: null,
    camera: null,
    film: null,
    lens: null,
    frames: [],
    ...details,
  };
}

/** The kind a version is added as, from its query: a scan unless said. */
function versionKindOf(kind: string | null): Version['kind'] {
  return kind === 'raw-scan' || kind === 'final' ? kind : 'scan';
}

/** A frame with one scan of the given file name, e.g. aFrame('1', '12340001.jpg'). */
export function aFrame(number: string | null, file: string): Frame {
  const n = file.slice(4, 8);
  return {
    id: `01JC8Z7K3M00000000000F${n}`,
    number,
    title: null,
    rating: null,
    notes: null,
    camera: null,
    lens: null,
    event: null,
    toScan: false,
    hidden: false,
    shot: null,
    defaultVersion: null,
    versions: [
      {
        id: `01JC8Z7K3M00000000000V${n}`,
        fileName: file,
        sha256: file,
        bytes: 3,
        width: 3,
        height: 2,
        added: '2026-11-02T12:00:00.000Z',
        rotate: 0,
        kind: 'scan',
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

/** How a site is shown when nothing is said: one grid, each photo's title. */
export const plainPresentation: Site['presentation'] = {
  groupBy: 'nothing',
  captions: ['title'],
};

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
  const sites: Site[] = (contents.sites ?? []).map((site) => ({
    ...site,
    presentation: site.presentation ?? plainPresentation,
  }));
  let settings =
    contents.settings === undefined ? setUpSettings : contents.settings;
  /** Every request, as "METHOD /path?query". */
  const requests: string[] = [];
  /** The If-Match header of every PATCH, in order. */
  const ifMatches: (string | null)[] = [];
  /** The body of every request to create a roll. */
  const created: unknown[] = [];
  /** The body of every request to change a roll's details. */
  const rollUpdates: unknown[] = [];
  /** The body of every request to export a frame once. */
  const quickExports: unknown[] = [];
  const searches: unknown[] = [];
  /** The slug of every site a build was started for, and every build cancelled. */
  const siteBuilds: string[] = [];
  const siteBuildsCancelled: string[] = [];
  const siteFreshness = new Map<string, { freshness: string; message: string }>(
    Object.entries(contents.siteStatuses ?? {}),
  );
  let siteBuildCalls = 0;
  let building: string | undefined;
  /** Every change to a site: which one, and what was sent. */
  const siteUpdates: { slug: string; body: unknown }[] = [];
  /** While set, a change to a site waits for it before it's answered. */
  let siteUpdatesHeld: Promise<undefined> | undefined;
  /** The body of every request to export into a folder, and the exports cancelled. */
  const folderExports: unknown[] = [];
  const folderExportsCancelled: string[] = [];
  /** The file name of every scan uploaded. */
  const uploads: string[] = [];
  /** Every frame deleted, as it was. */
  const deleted: Frame[] = [];
  // Each roll's and event's version, sent as its ETag: "v1", then up by one per change.
  const versions = new Map<string, number>();
  let nextId = 0;
  let statusCalls = 0;
  let stopped = false;
  let savesFail = false;

  const newId = () => {
    nextId += 1;
    return `01JC8Z7K3M${String(nextId).padStart(16, '0')}`;
  };
  const etagOf = (key: string) => `"v${String(versions.get(key) ?? 1)}"`;
  const versionOf = (key: string) => `v${String(versions.get(key) ?? 1)}`;
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
  /** Whether a year, year-month or year-month-day is a real date (an absent one is fine). */
  function isRealDate(date: string | null | undefined): boolean {
    const [year, month, day] = (date ?? '').split('-').map(Number);
    if (date === undefined || date === null || month === undefined) {
      return true;
    }
    if (month < 1 || month > 12) {
      return false;
    }
    return (
      day === undefined ||
      (day >= 1 && day <= new Date(Date.UTC(year ?? 0, month, 0)).getUTCDate())
    );
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
      if (body.ok && !isRealDate(body.value.date)) {
        // As the service does: a date that isn't on the calendar is refused.
        return Response.json(
          {
            error: 'invalid request',
            issues: [{ path: ['date'], message: "doesn't exist" }],
          },
          { status: 422 },
        );
      }
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
    // A roll sent with no number gets the next free one, as the service gives.
    const number =
      body.value.roll ??
      suggestRollNumber(
        patternOf(defaultRollNumberPattern),
        { shot: body.value.shot, event: null },
        rolls.map((r) => r.roll),
      );
    if (number === undefined) {
      return Response.json(
        {
          error: 'invalid request',
          issues: [{ path: ['roll'], message: 'no roll numbers are left' }],
        },
        { status: 422 },
      );
    }
    if (rolls.some((roll) => sameRollNumber(roll.roll, number))) {
      return Response.json(
        { error: `roll ${number} already exists` },
        { status: 409 },
      );
    }
    const roll: Roll = {
      id: newId(),
      roll: number,
      filed: false,
      name: body.value.name ?? null,
      notes: body.value.notes ?? null,
      shot: body.value.shot,
      event: body.value.event ?? null,
      camera: body.value.camera ?? null,
      film: body.value.film ?? null,
      lens: body.value.lens ?? null,
      frames: [],
    };
    rolls.push(roll);
    return Response.json(roll, { status: 201 });
  }

  async function renumberRolls(request: Request): Promise<Response> {
    const body = await bodyOf(request, renumberRollsRequest);
    if (!body.ok) {
      return body.response;
    }
    const { snapshot, unreadable: expectedUnreadable, changes } = body.value;
    if (
      snapshot.length !== rolls.length ||
      snapshot.some(
        ({ id, version }) =>
          !rolls.some((roll) => roll.id === id) || versionOf(id) !== version,
      ) ||
      JSON.stringify(expectedUnreadable) !== JSON.stringify(unreadable)
    ) {
      return Response.json(
        { error: 'the roll has changed since it was read' },
        { status: 409 },
      );
    }
    const changesById = new Map(changes.map((change) => [change.id, change]));
    if (changesById.size !== changes.length) {
      return Response.json(
        {
          error: 'invalid request',
          issues: [{ path: ['changes'], message: 'contains a duplicate roll' }],
        },
        { status: 422 },
      );
    }
    for (const requestChange of changes) {
      const roll = rolls.find((candidate) => candidate.id === requestChange.id);
      if (roll === undefined) {
        return Response.json(
          {
            error: 'invalid request',
            issues: [
              { path: ['changes'], message: 'includes an unknown roll' },
            ],
          },
          { status: 422 },
        );
      }
      if (roll.filed && roll.roll !== requestChange.roll) {
        return Response.json(
          {
            error: 'invalid request',
            issues: [
              {
                path: ['roll'],
                message: "A filed roll's number can't be changed.",
              },
            ],
          },
          { status: 422 },
        );
      }
    }
    const finalNumbers = rolls.map(
      (roll) => changesById.get(roll.id)?.roll ?? roll.roll,
    );
    if (!rollNumbersAreUnique(finalNumbers)) {
      return Response.json(
        {
          error: 'invalid request',
          issues: [
            { path: ['changes'], message: 'roll numbers must be unique' },
          ],
        },
        { status: 422 },
      );
    }
    for (const requestChange of changes) {
      const roll = rolls.find((candidate) => candidate.id === requestChange.id);
      if (roll !== undefined && roll.roll !== requestChange.roll) {
        roll.roll = requestChange.roll;
        change(roll.id);
      }
    }
    return new Response(null, { status: 204 });
  }

  /** A frame's details, as the service resolves them: the archive's author and copyright, then the roll's equipment and event, then the frame's own. */
  function detailsOf(roll: Roll, frame: Frame): FrameDetails {
    const fromArchive = (value: string) => ({
      value,
      source: { layer: 'archive' as const, id: setUpSettings.id },
    });
    const fromRoll = <T>(value: T) => ({
      value,
      source: { layer: 'roll' as const, id: roll.id },
    });
    const fromFrame = <T>(value: T) => ({
      value,
      source: { layer: 'frame' as const, id: frame.id },
    });
    const either = <T>(own: T | null, inherited: T | null) =>
      own !== null
        ? fromFrame(own)
        : inherited === null
          ? undefined
          : fromRoll(inherited);
    const camera = either(frame.camera, roll.camera);
    // Always the roll's (D45).
    const film = either(null, roll.film);
    const lens = either(frame.lens, roll.lens);
    const shot = either(frame.shot, roll.shot);
    // Marked as in no event, it has none whatever its roll has (D98).
    const event =
      frame.event === false ? undefined : either(frame.event, roll.event);
    return {
      ...(settings === null ? {} : { author: fromArchive(settings.author) }),
      ...(settings?.copyright === undefined || settings.copyright === null
        ? {}
        : { copyright: fromArchive(settings.copyright) }),
      ...(camera === undefined ? {} : { camera }),
      ...(film === undefined ? {} : { film }),
      ...(lens === undefined ? {} : { lens }),
      ...(event === undefined ? {} : { event }),
      ...(shot === undefined ? {} : { shot }),
    };
  }

  async function settingsRoute(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      return settings === null
        ? notFound()
        : Response.json(settings, { headers: { ETag: etagOf('settings') } });
    }
    if (request.method === 'POST') {
      if (settings !== null) {
        return Response.json({ error: 'already set up' }, { status: 409 });
      }
      const body = await bodyOf(request, createSettingsRequest);
      if (!body.ok) {
        return body.response;
      }
      settings = {
        ...setUpSettings,
        author: body.value.author,
        copyright: body.value.copyright ?? null,
      };
      return Response.json(settings, { status: 201 });
    }
    if (settings === null) {
      return notFound();
    }
    const refused = checkIfMatch(request, 'settings');
    if (refused !== undefined) {
      return refused;
    }
    const body = await bodyOf(request, updateSettingsRequest);
    if (!body.ok) {
      return body.response;
    }
    // As the service does: a pattern that isn't valid, or that some roll can't be numbered by, is refused.
    if (body.value.rollNumberPattern !== undefined) {
      const parsed = parseRollNumberPattern(body.value.rollNumberPattern);
      const message = !parsed.ok
        ? parsed.message
        : rolls
            .map((roll) => whatIsMissing(parsed.pattern, roll))
            .filter((missing) => missing !== undefined)
            .map((missing) => `needs ${missing} on every roll`)[0];
      if (message !== undefined) {
        return Response.json(
          {
            error: 'invalid request',
            issues: [{ path: ['rollNumberPattern'], message }],
          },
          { status: 422 },
        );
      }
    }
    // A detail left out stays as it is.
    settings = {
      ...settings,
      ...Object.fromEntries(
        Object.entries(body.value).filter(([, value]) => value !== undefined),
      ),
    };
    change('settings');
    return Response.json(settings, { headers: { ETag: etagOf('settings') } });
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
      if (request.method === 'DELETE') {
        rolls.splice(rolls.indexOf(roll), 1);
        return new Response(null, { status: 204 });
      }
      const body = await bodyOf(request, updateRollRequest);
      if (!body.ok) {
        return body.response;
      }
      rollUpdates.push(body.value);
      // A number another roll has is a problem with the number, as the service says.
      if (
        body.value.roll !== undefined &&
        rolls.some(
          (r) =>
            r.id !== roll.id && sameRollNumber(r.roll, body.value.roll ?? ''),
        )
      ) {
        return Response.json(
          {
            error: 'invalid request',
            issues: [
              { path: ['roll'], message: 'is already used by another roll' },
            ],
          },
          { status: 422 },
        );
      }
      // A detail left out stays as it is.
      const changes = Object.fromEntries(
        Object.entries(body.value).filter(([, value]) => value !== undefined),
      );
      Object.assign(roll, changes);
      change(roll.id);
      return Response.json(roll, { headers: { ETag: etagOf(roll.id) } });
    }
    if (frameId === undefined && request.method === 'DELETE') {
      const refused = checkIfMatch(request, roll.id);
      if (refused !== undefined) {
        return refused;
      }
      const ids = (url.searchParams.get('frameIds') ?? '').split(',');
      if (!ids.every((id) => roll.frames.some((f) => f.id === id))) {
        return notFound();
      }
      deleted.push(...roll.frames.filter((f) => ids.includes(f.id)));
      roll.frames = roll.frames.filter((f) => !ids.includes(f.id));
      change(roll.id);
      return new Response(null, {
        status: 204,
        headers: { ETag: etagOf(roll.id) },
      });
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
          title: null,
          rating: null,
          notes: null,
          camera: null,
          lens: null,
          event: null,
          toScan: false,
          hidden: false,
          shot: null,
          defaultVersion: null,
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
      const body = await bodyOf(request, updateFramesRequest);
      if (!body.ok) {
        return body.response;
      }
      if ('numbers' in body.value) {
        for (const { frameId: id, number } of body.value.numbers) {
          roll.frames = roll.frames.map((frame) =>
            frame.id === id ? { ...frame, number } : frame,
          );
        }
      } else {
        const { frameIds, ...change } = body.value;
        // A detail left out stays as each frame has it.
        const given = Object.fromEntries(
          Object.entries(change).filter(([, value]) => value !== undefined),
        );
        roll.frames = roll.frames.map((frame) =>
          frameIds.includes(frame.id) ? { ...frame, ...given } : frame,
        );
      }
      change(roll.id);
      return Response.json(roll, { headers: { ETag: etagOf(roll.id) } });
    }
    const frame = roll.frames.find((f) => f.id === frameId);
    if (frame === undefined) {
      return notFound();
    }
    if (versions === 'details') {
      return Response.json(detailsOf(roll, frame));
    }
    if (versions === undefined && request.method === 'DELETE') {
      const refused = checkIfMatch(request, roll.id);
      if (refused !== undefined) {
        return refused;
      }
      roll.frames = roll.frames.filter((f) => f.id !== frameId);
      deleted.push(frame);
      change(roll.id);
      return new Response(null, {
        status: 204,
        headers: { ETag: etagOf(roll.id) },
      });
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
      // A detail left out stays as it is.
      const updated = {
        ...frame,
        ...Object.fromEntries(
          Object.entries(body.value).filter(([, value]) => value !== undefined),
        ),
      };
      roll.frames = roll.frames.map((f) => (f.id === frameId ? updated : f));
      change(roll.id);
      return Response.json(updated, { headers: { ETag: etagOf(roll.id) } });
    }
    if (request.method === 'DELETE') {
      const gone = frame.versions.find((v) => v.id === rest[3]);
      if (gone === undefined) {
        return notFound();
      }
      const refused = checkIfMatch(request, roll.id);
      if (refused !== undefined) {
        return refused;
      }
      roll.frames = roll.frames.map((f) =>
        f.id === frameId
          ? {
              ...f,
              // As the service does: the first is shown again.
              defaultVersion:
                f.defaultVersion === gone.id ? null : f.defaultVersion,
              versions: f.versions.filter((v) => v.id !== gone.id),
            }
          : f,
      );
      change(roll.id);
      return new Response(null, {
        status: 204,
        headers: { ETag: etagOf(roll.id) },
      });
    }
    if (request.method === 'PATCH') {
      const turned = frame.versions.find((v) => v.id === rest[3]);
      if (turned === undefined) {
        return notFound();
      }
      const refused = checkIfMatch(request, roll.id);
      if (refused !== undefined) {
        return refused;
      }
      const body = await bodyOf(request, updateVersionRequest);
      if (!body.ok) {
        return body.response;
      }
      // A detail left out stays as it is.
      const updated = {
        ...turned,
        ...(body.value.rotate === undefined
          ? {}
          : { rotate: body.value.rotate }),
        ...(body.value.kind === undefined ? {} : { kind: body.value.kind }),
      };
      roll.frames = roll.frames.map((f) =>
        f.id === frameId
          ? {
              ...f,
              versions: f.versions.map((v) =>
                v.id === turned.id ? updated : v,
              ),
            }
          : f,
      );
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
    const version: Version = {
      id: newId(),
      fileName: file,
      sha256: hash,
      bytes: 3,
      width: 3,
      height: 2,
      added: '2026-11-02T12:00:00.000Z',
      rotate: 0,
      kind: versionKindOf(url.searchParams.get('kind')),
    };
    roll.frames = roll.frames.map((f) =>
      f.id === frameId ? { ...f, versions: [...f.versions, version] } : f,
    );
    change(roll.id);
    return Response.json(version, { status: 201 });
  }

  /** An export into a folder: started (the chooser may be cancelled), followed, or cancelled. */
  async function folderExport(
    request: Request,
    job: string | undefined,
  ): Promise<Response> {
    if (job === undefined) {
      const body = await bodyOf(request, folderExportRequest);
      if (!body.ok) {
        return body.response;
      }
      folderExports.push(body.value);
      return Response.json({
        job: contents.folderChooserCancelled === true ? null : 'job-1',
      });
    }
    if (request.method === 'DELETE') {
      folderExportsCancelled.push(job);
      return new Response(null, { status: 204 });
    }
    const states = contents.folderExportStates ?? [
      { state: 'done' as const, done: 2, written: 2 },
    ];
    statusCalls += 1;
    const now = states[Math.min(statusCalls, states.length) - 1];
    return Response.json({
      total: 2,
      leftOut: 0,
      ...now,
    });
  }

  /**
   * The frames on a selection as the fake knows them: every frame that isn't
   * hidden, minus those left off, with those pinned marked. Rules aren't
   * matched (the service's tests do that).
   */
  function framesOn(selection: {
    readonly pinned: readonly { rollId: string; frameId: string }[];
    readonly hidden: readonly { rollId: string; frameId: string }[];
  }) {
    const is = (
      list: readonly { rollId: string; frameId: string }[],
      r: string,
      f: string,
    ) => list.some((ref) => ref.rollId === r && ref.frameId === f);
    return rolls
      .flatMap((roll) =>
        roll.frames
          .filter((frame) => !frame.hidden)
          .map((frame) => ({ rollId: roll.id, frameId: frame.id })),
      )
      .filter(({ rollId, frameId }) => !is(selection.hidden, rollId, frameId))
      .map((ref) => ({
        ...ref,
        why: is(selection.pinned, ref.rollId, ref.frameId)
          ? ('pinned' as const)
          : ('rules' as const),
      }));
  }

  /** Building a site and asking how it stands, as the service answers. */
  function siteBuild(
    request: Request,
    slug: string,
    what: 'build' | 'status',
  ): Response {
    const states = contents.siteBuildStates ?? [
      { state: 'done' as const, done: 3, total: 3 },
    ];
    if (what === 'build') {
      if (request.method === 'DELETE') {
        siteBuildsCancelled.push(slug);
        return new Response(null, { status: 204 });
      }
      siteBuilds.push(slug);
      siteBuildCalls = 0;
      building = slug;
      return Response.json(
        {
          state: 'running',
          done: 0,
          total: 0,
          photos: 0,
          leftOut: 0,
          imagesMade: 0,
          imagesUnchanged: 0,
        },
        { status: 202 },
      );
    }
    const stated = siteFreshness.get(slug) ?? {
      freshness: 'not-built',
      message: 'Not built yet',
    };
    if (building !== slug) {
      return Response.json({ ...stated, build: null });
    }
    siteBuildCalls += 1;
    const now = states[Math.min(siteBuildCalls, states.length) - 1];
    if (now?.state === 'done') {
      siteFreshness.set(slug, {
        freshness: 'up-to-date',
        message: 'Up to date',
      });
    }
    return Response.json({
      ...(now?.state === 'done'
        ? { freshness: 'up-to-date', message: 'Up to date' }
        : stated),
      build: {
        photos: 2,
        leftOut: 0,
        imagesMade: 3,
        imagesUnchanged: 1,
        ...now,
      },
    });
  }

  async function sitesRoute(
    request: Request,
    slug: string | undefined,
    below?: string,
  ): Promise<Response> {
    if (slug === undefined) {
      if (request.method === 'GET') {
        return Response.json({
          sites: [...sites]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((site) => ({
              slug: site.slug,
              name: site.name,
              frameCount: framesOn(site.selection).length,
            })),
        });
      }
      const body = await bodyOf(request, createSiteRequest);
      if (!body.ok) {
        return body.response;
      }
      const made: Site = {
        id: newId(),
        slug: slugFor(body.value.name),
        name: body.value.name,
        selection: { rules: [], pinned: [], hidden: [] },
        presentation: plainPresentation,
      };
      if (sites.some((site) => site.slug === made.slug)) {
        return Response.json(
          { error: `site ${made.slug} already exists` },
          { status: 409 },
        );
      }
      sites.push(made);
      return Response.json(made, {
        status: 201,
        headers: { ETag: etagOf(`site:${made.slug}`) },
      });
    }
    const index = sites.findIndex((site) => site.slug === slug);
    const current = sites[index];
    if (current === undefined) {
      return notFound();
    }
    if (below === 'build' || below === 'status') {
      return siteBuild(request, slug, below);
    }
    const key = `site:${slug}`;
    if (request.method === 'GET') {
      return Response.json(current, { headers: { ETag: etagOf(key) } });
    }
    if (request.method === 'DELETE') {
      sites.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    if (savesFail) {
      return new Response('', { status: 500 });
    }
    await siteUpdatesHeld;
    const refused = checkIfMatch(request, key);
    if (refused !== undefined) {
      return Response.json(
        { error: 'the site has changed since it was read' },
        { status: 409 },
      );
    }
    const body = await bodyOf(request, updateSiteRequest);
    if (!body.ok) {
      return body.response;
    }
    const name = body.value.name ?? current.name;
    const newSlug = slugFor(name);
    if (newSlug !== slug && sites.some((site) => site.slug === newSlug)) {
      return Response.json(
        { error: `site ${newSlug} already exists` },
        { status: 409 },
      );
    }
    const updated: Site = {
      ...current,
      slug: newSlug,
      name,
      ...(body.value.selection === undefined
        ? {}
        : { selection: body.value.selection }),
      ...(body.value.presentation === undefined
        ? {}
        : { presentation: body.value.presentation }),
    };
    sites[index] = updated;
    change(`site:${newSlug}`);
    if (siteFreshness.get(slug)?.freshness === 'up-to-date') {
      siteFreshness.set(newSlug, {
        freshness: 'out-of-date',
        message: 'Out of date: options changed',
      });
    }
    siteUpdates.push({ slug, body: body.value });
    return Response.json(updated, {
      headers: { ETag: etagOf(`site:${newSlug}`) },
    });
  }

  /**
   * Finds frames as the service does, except that it doesn't match rules (the
   * service's tests do): every frame that isn't hidden, minus those left off,
   * with those pinned marked. What it was asked is in `searches`.
   */
  async function searchFrames(request: Request): Promise<Response> {
    const body = await bodyOf(request, frameSelection);
    if (!body.ok) {
      return body.response;
    }
    searches.push(body.value);
    const frames = framesOn(body.value);
    return Response.json({ count: frames.length, frames });
  }

  /** Prepares a frame's export as the service does: refused if hidden or with no scan. */
  async function quickExport(request: Request): Promise<Response> {
    const body = await bodyOf(request, quickExportRequest);
    if (!body.ok) {
      return body.response;
    }
    quickExports.push(body.value);
    const found = body.value.frames.map(({ rollId, frameId }) =>
      rolls.find((r) => r.id === rollId)?.frames.find((f) => f.id === frameId),
    );
    if (found.some((frame) => frame === undefined)) {
      return notFound();
    }
    // A zip leaves out frames it can't make; a JPEG is refused.
    if (
      body.value.output === 'jpeg' &&
      found.some(
        (frame) => frame?.hidden === true || frame?.versions.length === 0,
      )
    ) {
      return Response.json(
        {
          error: 'invalid request',
          issues: [{ path: ['frame'], message: 'no' }],
        },
        { status: 422 },
      );
    }
    return Response.json(
      { url: `/api/exports/quick/ticket-${String(quickExports.length)}` },
      { status: 201 },
    );
  }

  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (stopped) {
      return new Response('', { status: 502 });
    }
    if (
      savesFail &&
      (request.method === 'PATCH' ||
        (request.method === 'POST' && url.pathname === '/api/rolls/numbering'))
    ) {
      return new Response('', { status: 500 });
    }
    const [, api, resource, ...rest] = url.pathname.split('/');
    if (api !== 'api') {
      return notFound();
    }
    switch (resource ?? '') {
      case 'settings':
        return settingsRoute(request);
      case 'equipment':
        return equipment(request, rest[0] ?? '');
      case 'events':
        return eventsRoute(request, rest[0]);
      case 'exports':
        return rest[0] === 'folder'
          ? folderExport(request, rest[1])
          : quickExport(request);
      case 'frames':
        return searchFrames(request);
      case 'sites':
        return sitesRoute(request, rest[0], rest[1]);
      case 'health':
        return Response.json({
          status: 'ok',
          exportToFolder: contents.exportToFolder ?? false,
        });
      case 'rolls': {
        if (rest.length === 0) {
          return request.method === 'GET'
            ? Response.json({
                rolls: [...rolls].sort((a, b) =>
                  compareRollNumbers(a.roll, b.roll),
                ),
                unreadable,
              })
            : createRoll(request);
        }
        const [rollId, ...below] = rest;
        if (rollId === 'numbering' && below.length === 0) {
          return request.method === 'GET'
            ? Response.json({
                rolls: [...rolls]
                  .sort((a, b) => compareRollNumbers(a.roll, b.roll))
                  .map((roll) => ({
                    roll,
                    version: versionOf(roll.id),
                  })),
                unreadable,
              })
            : renumberRolls(request);
        }
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
    rollUpdates,
    uploads,
    deleted,
    quickExports,
    searches,
    sites,
    siteUpdates,
    /** Holds every change to a site until the function returned is called. */
    holdSiteUpdates(): () => void {
      const held = Promise.withResolvers<undefined>();
      siteUpdatesHeld = held.promise;
      return () => {
        siteUpdatesHeld = undefined;
        held.resolve(undefined);
      };
    },
    siteBuilds,
    siteBuildsCancelled,
    /** Changes how a site stands, as an edit elsewhere would. */
    setSiteStatus(
      slug: string,
      status: { freshness: string; message: string },
    ) {
      siteFreshness.set(slug, status);
    },
    folderExports,
    folderExportsCancelled,
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
    /** The settings as they are now, or null if FilmFile isn't set up. */
    settings: () => settings,
    /** Changes the settings elsewhere, as another tab would. */
    changeSettings() {
      change('settings');
    },
    /** Changes a site elsewhere, as another tab would, so the page's version is stale. */
    changeSite(slug: string) {
      change(`site:${slug}`);
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
