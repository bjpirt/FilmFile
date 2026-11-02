# FilmFile

A local-first tool for cataloguing film photographs. It links every frame back to its physical negative (roll, sleeve, edge number), organises frames by roll and by nested events, and keeps every version of each image: lab scan, raw camera scans, edits and exports.

Status: design agreed, not yet built.

## How it works

- **Your filesystem is the archive.** Metadata is stored as JSON next to the images, and any database is just a cache that can be rebuilt.
- **Originals are never modified.** Edits and exports are added as new versions.
- **S3 for backup and sync** between devices, and **workflows** that run when the archive changes (for example, publishing to a web gallery).
- A local API service that owns the data, with a browser UI as its client.

## Docs

- [Design](docs/design.md): goals, domain model, archive layout and architecture.
- [Plan for phases 0 and 1](docs/plan-phase-0-1.md): foundations and the MVP (rolls and frames).
- [CLAUDE.md](CLAUDE.md): engineering conventions.
