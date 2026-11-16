/** The message of a refused request's issue at `path` (e.g. `['publish', 'bucket']`), if it has one. */
export function issueFor(
  error: unknown,
  path: readonly string[],
): string | undefined {
  if (typeof error !== 'object' || error === null || !('issues' in error)) {
    return undefined;
  }
  const { issues } = error;
  if (!isUnknownArray(issues)) {
    return undefined;
  }
  for (const issue of issues) {
    if (
      typeof issue === 'object' &&
      issue !== null &&
      'path' in issue &&
      'message' in issue &&
      isUnknownArray(issue.path) &&
      typeof issue.message === 'string' &&
      issue.path.join('/') === path.join('/')
    ) {
      return issue.message;
    }
  }
  return undefined;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
