/**
 * Runs async work one at a time per key, in the order it was asked for. Used
 * so that two requests changing the same roll can't interleave their reads
 * and writes. It works within this process: the service is the archive's
 * only writer.
 */
export class KeyedLock {
  readonly #tails = new Map<string, Promise<unknown>>();

  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(key) ?? Promise.resolve();
    // Wait for the previous work whether it succeeded or failed; its caller handles its outcome.
    const result = previous.then(work, work);
    const tail = result.catch(() => undefined);
    this.#tails.set(key, tail);
    try {
      return await result;
    } finally {
      if (this.#tails.get(key) === tail) {
        this.#tails.delete(key);
      }
    }
  }
}
