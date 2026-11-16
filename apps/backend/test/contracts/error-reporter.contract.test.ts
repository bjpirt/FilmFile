import { afterEach, beforeEach, vi } from 'vitest';
import { InMemoryErrorReporter } from '../../src/adapters/outbound/memory/in-memory-error-reporter.ts';
import { ConsoleErrorReporter } from '../../src/adapters/outbound/node/console-error-reporter.ts';
import { errorReporterContract } from './error-reporter-contract.ts';

// Keeps the console reporter's output out of the test run's.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

errorReporterContract(
  'InMemoryErrorReporter',
  () => new InMemoryErrorReporter(),
);
errorReporterContract('ConsoleErrorReporter', () => new ConsoleErrorReporter());
