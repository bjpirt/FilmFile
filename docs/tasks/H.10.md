# H.10 In-memory adapters and contract suites

**Status:** done · **Built in:** 1. Foundations and the API slice

## What was built

One shared contract suite per port, run against the in-memory and filesystem adapters; `composeInMemory` for fast use-case tests. *(Was 0.4.2, 0.4.3 and the in-memory halves of 1.2.)* Contract suites in `apps/backend/test/contracts/` for `RollRepository`, `BlobStore` and `PreviewProvider`, each run against its in-memory and real adapter; adapter tests keep only what's specific to them. `ImageInspector` has one adapter (sharp, which needs no disk), so no suite yet. `composeLocal` and `composeInMemory` share `useCasesFor`, so only their adapters differ.
