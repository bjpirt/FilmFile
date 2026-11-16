/**
 * Where an unexpected failure in background work goes, so it can be looked
 * into: the service's log, never the page, which is told only that it failed
 * (D113). Expected failures, which a `Result` describes, aren't reported.
 */
export interface ErrorReporter {
  /** `what` says what was being done, e.g. "Couldn't build site iceland". */
  report(what: string, error: unknown): void;
}
