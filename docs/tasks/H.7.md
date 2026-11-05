# H.7 Frame and version use cases

**Status:** done · **Built in:** H: Hardening the slice

## What was built

`CreateFrame`, `AddVersion`, `GetThumbnail` and `GetOriginal` behind `BlobStore`, `ImageInspector` and `PreviewProvider` ports with their adapters. *(Was 1.2.1, 1.2.5, 1.2.7, 1.3.6, 1.3.11.)* `ImageInspector` also hashes the file and does the JPEG signature and pixel checks, so duplicates are caught before anything is stored. `BlobStore` decides the file's path and returns it; `put` takes the bytes rather than a stream for now (uploads are capped at 200 MB). New domain errors `ImageRejected` and `ScanAlreadyInRoll` keep 409/415/422 in the one error mapper. Folder naming moved to the domain, since the layout is an archive rule. In-memory blob store and preview provider serve the use-case tests.
