/** Whether a Node filesystem error has the given code, e.g. `ENOENT`. */
export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}
