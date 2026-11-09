# H.6 Roll use cases and repository

**Status:** done · **Built in:** 1. Foundations and the API slice

## What was built

Move roll logic out of the routes into `CreateRoll`, `ListRolls` and `GetRoll` use cases (`execute(ctx, input)` returning `Result`) behind a `RollRepository` port with a filesystem adapter. Routes map `DomainError` to status codes in one place. *(Was part of 0.4.1, 1.3.3, 1.4.1.)* Done with domain `Roll`, `Frame`, `Version` and `RollNumber` types, `roll.json` parsed and mapped explicitly in the filesystem adapter, and an in-memory repository (brought forward from H.10) for the use-case tests. `ListRolls` returns the rolls rather than a `Result`, since it can't fail in an expected way. Frame and version routes use the repository directly until H.7. Every request uses a placeholder `ArchiveContext` until 1.3.1 gives the archive an ID.
