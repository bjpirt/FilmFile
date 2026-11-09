# H.8 Persistence schemas and stable serialisation

**Status:** done · **Built in:** 1. Foundations and the API slice

## What was built

Zod schemas for `roll.json` (and `archive.json` and equipment files when they arrive), `schema: 1`, an empty migration registry, explicit mapping to domain types; fixed key order, 2-space indent and trailing newline, with a property test that a round trip is byte-identical. *(Was 0.4.4, 0.4.5.)* The schema and mapping arrived with H.6; this added the migration registry, `fast-check` property tests that a round trip gives back the same roll and byte-identical text, and reporting of unreadable files: `GET /api/rolls` returns `{ rolls, unreadable }`, and the rolls page names each unreadable roll and its problem (D18).
