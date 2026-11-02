/** A value narrowed by a type guard, for test data known to be valid. */
export function checked<T extends string>(
  value: string,
  is: (value: string) => value is T,
): T {
  if (!is(value)) {
    throw new Error(`bad test data: ${value}`);
  }
  return value;
}
