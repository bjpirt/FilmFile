import type { Clock } from '../../../application/ports/clock.ts';

export class NodeClock implements Clock {
  now(): Date {
    return new Date();
  }
}
