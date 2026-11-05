# H.9 Atomic writes and version tokens

**Status:** done · **Built in:** H: Hardening the slice

## What was built

Per-file locks in the cache directory, version = SHA-256 of the file bytes, temp file + fsync + rename. Reads return `{ value, version }`; saves take the expected version. `ETag` on reads and `If-Match` on writes (428 when missing, 409 when stale); appends lock without needing a token (D11). Tests: concurrent saves serialise, parallel appends all land, a crash between write and rename leaves the original intact. *(Was 0.4.6 and the ETag part of 1.4.1.)* Done with two changes. Locks are per roll within the service (`KeyedLock`), not lock files: the service is the archive's only writer, and a startup check that no other service has the archive open would guard that more simply than per-file lock files. `If-Match` (428 when missing, 409 when stale) arrives with the first endpoint that edits a roll (1.4.1): today's writes are creates and appends, which need no token (D11). Appends use `RollRepository.change`, which reads, applies and writes under the roll's lock. Creating a roll writes a temp file and hard-links it into place, so it's atomic and can't replace an existing roll.json.
