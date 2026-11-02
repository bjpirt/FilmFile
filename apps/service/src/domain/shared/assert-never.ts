/**
 * Ends an exhaustive `switch`: the call only type-checks when every case is
 * handled. Reaching it at runtime means data broke the types, which is a bug.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
