/** The current time. The core never reads the system clock itself, so tests can fix it. */
export interface Clock {
  now(): Date;
}
