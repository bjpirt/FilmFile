# H.11 Test data and fixtures

**Status:** done · **Built in:** 1. Foundations and the API slice

## What was built

Builders (`aRoll()`, `aFrame()`), and the lab scan generator with the fixture sets (head to tail, tail to head, a skipped frame, starting at `00`, a `12A`). *(Was 0.5.)* Builders take plain override objects (`aRoll({ roll: '2025-003' })`, `labScanFrames(36)`) in `apps/backend/test/support/builders.ts`. Lab scans are 240×160 JPEGs showing the frame number in seven-segment digits drawn with SVG shapes (no fonts needed); each fixture set has six scans and its own batch, in `test/support/lab-scans.ts`.
