import { InMemoryExportTickets } from '../../src/adapters/outbound/memory/in-memory-export-tickets.ts';
import { exportTicketsContract } from './export-tickets-contract.ts';

exportTicketsContract(
  'InMemoryExportTickets',
  (clock) => new InMemoryExportTickets(clock),
);
