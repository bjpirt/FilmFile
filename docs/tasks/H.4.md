# H.4 Safe paths and upload checks

**Status:** done · **Built in:** 1. Foundations and the API slice

## What was built

A safe path helper that every filesystem path goes through, rejecting absolute paths, `..`, separators in names, null bytes and anything resolving outside the root (table-driven traversal tests). Uploads: the 200 MB limit enforced while streaming (D4), a JPEG signature check, and sharp's input pixel limit; tests for oversized (413) and disguised (415) uploads. The pixel limit is 100 megapixels, checked from the header before anything is decoded (422), and passed to sharp for thumbnails; a file that starts like a JPEG but can't be read is also a 422. Paths stored in `roll.json` go through the helper too, so an edited `roll.json` can't serve files from elsewhere. *(Was 0.6.1, 1.2.2 and part of 1.4.4.)*
