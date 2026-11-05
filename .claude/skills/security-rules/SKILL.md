---
name: security-rules
description: FilmFile's security rules in full — Host and Origin checks, content types, security headers, error responses, input validation, safe filesystem paths, upload limits, and supply-chain rules for dependencies and CI. Use when changing the HTTP adapter or routes, handling uploads or paths, adding a dependency, or editing CI.
---

# Security rules

FilmFile runs on localhost without login, but **any website the user visits can try to talk to it**, and it handles uploaded files. Treat it as exposed.

**Threats we design against:** malicious web pages reaching the local API (cross-site request forgery, DNS rebinding); crafted uploads and crafted JSON; path traversal into the filesystem; supply-chain attacks through dependencies and CI; and a later move to cloud hosting.

**Request handling (HTTP adapter)**

- Bind to `127.0.0.1` only.
- **Host allow-list:** reject (403) any request whose `Host` isn't `localhost`, `127.0.0.1` or `[::1]` on the configured port. This defeats DNS rebinding.
- **Origin check:** reject (403) any request carrying an `Origin` other than the UI's own origin. State-changing requests must have a matching `Origin`. No permissive CORS, never `*`.
- **JSON bodies require `Content-Type: application/json`**, so cross-site forms can't send them.
- Don't rely on browser protections such as Chrome's Local Network Access prompt; not every browser has them.
- Security headers on every response: a strict Content Security Policy (`default-src 'self'`), `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`.
- Error responses never include stack traces, file paths or internal details; log them server-side with a correlation ID.

**Input and files**

- Validate every input with Zod at the boundary, including path parameters, query strings and headers. Roll numbers, file names and lab patterns have strict formats.
- **Never build filesystem paths from user input directly.** Resolve every path through one helper that rejects absolute paths, `..`, separators in names, and anything that resolves outside the archive or cache root.
- **Uploads:** maximum file size, an allow-list of image types checked by file signature (magic bytes) rather than extension, and sharp's input pixel limit.
- Responses expose DTOs only, never internal objects or absolute paths. The one exception is the read-only `folder` field of `GET /api/settings` (FF-150), the FilmFile folder's path, so Settings can show it (D64). No route accepts a folder path: it's set by `FILMFILE_FOLDER` or the desktop app's native chooser only.

**Dependencies and CI (supply chain)**

- pnpm with a committed lockfile; CI installs with `--frozen-lockfile`.
- In `pnpm-workspace.yaml`: `minimumReleaseAge` of at least 3 days, `allowBuilds` listing only packages that genuinely need install scripts (e.g. `sharp`, `better-sqlite3`, `esbuild`), `strictDepBuilds: true`, `blockExoticSubdeps: true`, `trustPolicy: no-downgrade`.
- `pnpm audit --audit-level high` (or OSV-Scanner) in CI, and Dependabot or Renovate for updates.
- GitHub Actions pinned to full commit SHAs, with `permissions: contents: read` by default.
- Secret scanning (gitleaks) in CI. No secrets in the repo; configuration comes from environment variables or a local, git-ignored config file. Future AWS access uses named profiles or OIDC, never committed keys.
- Static analysis: CodeQL if the repository is public, otherwise Semgrep's free rules.

**Security tests** are part of the API suite: wrong `Host`, foreign `Origin`, missing content type, path traversal attempts, oversized and disguised uploads.
