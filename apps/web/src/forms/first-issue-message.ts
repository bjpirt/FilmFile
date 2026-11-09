/** The first message of a refused request's issues, if it has any. */
export function firstIssueMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('issues' in error)) {
    return undefined;
  }
  if (!isUnknownArray(error.issues)) {
    return undefined;
  }
  for (const issue of error.issues) {
    if (
      typeof issue === 'object' &&
      issue !== null &&
      'message' in issue &&
      typeof issue.message === 'string'
    ) {
      return issue.message;
    }
  }
  return undefined;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
