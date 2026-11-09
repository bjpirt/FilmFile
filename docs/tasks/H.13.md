# H.13 One fake service for the web tests

**Status:** done · **Built in:** 1. Foundations and the API slice

## What was built

`apps/web/src/testing/fake-archive.ts` answers the whole API from an archive kept in memory, as the service does (slugs, ETags and If-Match, duplicate checks, newest-first events, uploads with content hashes), with `aRoll` and `aFrame` builders and `stop()`, `failSaves()`, `changeRoll()` and `changeEvent()` for the service failing or changing elsewhere. The page tests arrange the archive, act through the page, and assert on the page or the archive; the five fakes they had are gone. Excluded from coverage as test code.
