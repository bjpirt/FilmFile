import type { Context } from 'hono';
import { assertNever } from '../../../domain/shared/assert-never.ts';
import { publishFailureMessage } from '../../../domain/sites/publish-failure-message.ts';
import type {
  AlreadyExists,
  Busy,
  ConcurrencyConflict,
  DomainError,
  ImageRejected,
  MappingInvalid,
  NotFound,
  PublishFailed,
  ScanAlreadyInRoll,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';

function notFound(c: Context, error: NotFound) {
  return c.json({ error: `no ${error.entity} with ID ${error.id}` }, 404);
}

function conflict(c: Context, error: AlreadyExists | ConcurrencyConflict) {
  return c.json(
    {
      error:
        error.kind === 'already-exists'
          ? `${error.entity} ${error.id} already exists`
          : `the ${error.entity} has changed since it was read`,
    },
    409,
  );
}

function invalid(c: Context, error: ValidationFailed | MappingInvalid) {
  return c.json(
    {
      error: 'invalid request' as const,
      issues: error.issues.map(({ path, message }) => ({
        path: [...path],
        message,
      })),
    },
    422,
  );
}

function busy(c: Context, error: Busy) {
  const doing = {
    building: 'built',
    publishing: 'published',
    unpublishing: 'unpublished',
  }[error.doing];
  return c.json({ error: `the ${error.entity} is being ${doing}` }, 409);
}

function publishFailed(c: Context, error: PublishFailed) {
  return c.json(
    { error: publishFailureMessage(error), reason: error.reason },
    502,
  );
}

function scanAlreadyInRoll(c: Context, error: ScanAlreadyInRoll) {
  return c.json(
    { error: 'this scan is already in the roll', frameId: error.frameId },
    409,
  );
}

function imageRejected(c: Context, error: ImageRejected) {
  switch (error.reason) {
    case 'unsupported-type':
      return c.json(
        { error: 'The file is not a JPEG, PNG, WebP, TIFF or raw.' },
        415,
      );
    case 'unreadable':
      return c.json({ error: 'The file could not be read as an image.' }, 422);
    case 'too-many-pixels':
      return c.json(
        {
          error: `The image has more than ${String(error.maxPixels / 1_000_000)} megapixels.`,
        },
        422,
      );
    default:
      return assertNever(error);
  }
}

/** The response for each kind of error, so routes' declared responses can be checked. */
type ResponseFor<E extends DomainError> = E extends NotFound
  ? ReturnType<typeof notFound>
  : E extends AlreadyExists | ConcurrencyConflict
    ? ReturnType<typeof conflict>
    : E extends ScanAlreadyInRoll
      ? ReturnType<typeof scanAlreadyInRoll>
      : E extends ImageRejected
        ? ReturnType<typeof imageRejected>
        : E extends Busy
          ? ReturnType<typeof busy>
          : E extends PublishFailed
            ? ReturnType<typeof publishFailed>
            : ReturnType<typeof invalid>;

function responseFor(c: Context, error: DomainError) {
  switch (error.kind) {
    case 'not-found':
      return notFound(c, error);
    case 'already-exists':
    case 'concurrency-conflict':
      return conflict(c, error);
    case 'validation-failed':
    case 'mapping-invalid':
      return invalid(c, error);
    case 'scan-already-in-roll':
      return scanAlreadyInRoll(c, error);
    case 'image-rejected':
      return imageRejected(c, error);
    case 'busy':
      return busy(c, error);
    case 'publish-failed':
      return publishFailed(c, error);
    default:
      return assertNever(error);
  }
}

/** The one place where expected failures become HTTP status codes. */
export function domainErrorResponse<E extends DomainError>(
  c: Context,
  error: E,
): ResponseFor<E> {
  // TypeScript can't match the switch's branches to ResponseFor<E>, though
  // they do match: domain-error-response.test.ts checks each kind.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return responseFor(c, error) as ResponseFor<E>;
}
