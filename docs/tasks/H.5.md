# H.5 IDs, clock and ID generator

**Status:** done · **Built in:** 1. Foundations and the API slice

## What was built

Branded `RollId`, `FrameId`, `VersionId` and `ArchiveId` with parse functions, and `ArchiveContext`. `Clock` and `IdGenerator` ports with node adapters, a fixed clock and a sequential generator for tests. IDs are branded through type guards, so no type assertions are needed. The routes already take the clock and generator (from `composeLocal`, which tests can override), so versions' `added` times and new IDs are predictable in tests. *(Was 0.2.3, 0.2.4.)*
