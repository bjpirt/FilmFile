# FilmFile

A local-first tool for cataloguing film photographs. It links every frame back to its physical negative (roll, sleeve, frame number), organises frames by roll and by nested events, and keeps every version of each image: lab scan, raw camera scans, edits and exports.

Status: early. Rolls and lab scans work through the API; the UI is a shell.

## Running it

Needs Node 26 and pnpm.

```sh
pnpm install
pnpm dev                                   # backend and UI with live reload, using .dev-archive/
pnpm build && FILMFILE_ARCHIVE=~/archive pnpm start   # the built UI, served by the backend
```

The UI is at http://localhost:5173 with `pnpm dev`, or http://127.0.0.1:4310 with `pnpm start`. API docs are at `/api/docs`. `pnpm verify` runs every check CI runs.

## How it works

- **Your filesystem is the archive.** Metadata is stored as JSON next to the images, and any database is just a cache that can be rebuilt.
- **Originals are never modified.** Edits and exports are added as new versions.
- **S3 for backup and sync** between devices, and **workflows** that run when the archive changes (for example, publishing to a web gallery).
- A local API service that owns the data, with a browser UI as its client.

## Docs

- [Design](docs/design.md): goals, domain model, archive layout and architecture.
- [Plan for phases 0 and 1](docs/plan-phase-0-1.md): foundations and the MVP (rolls and frames).
- [CLAUDE.md](CLAUDE.md): engineering conventions.
