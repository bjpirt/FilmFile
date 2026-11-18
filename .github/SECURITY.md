# Security policy

FilmFile is in early development, made by one person. Thank you for taking the time to report a problem.

## Reporting a vulnerability

Please report it privately, through [GitHub's private vulnerability reporting](https://github.com/bjpirt/FilmFile/security/advisories/new) (the repository's Security tab › "Report a vulnerability"). Please don't open a public issue or pull request for it.

It helps to include:

- what an attacker could do, and what they'd need first (a web page you visit, a file you import, access to your computer);
- how to reproduce it: the version (Settings shows it) or commit, your operating system, and the steps;
- any fix you'd suggest.

I'll aim to reply within a week, keep you told how a fix is going, and credit you in the release that fixes it, unless you'd rather not be named.

## Supported versions

Only the latest release, and `main`, get security fixes.

## What's in scope

- The local service: it listens on `127.0.0.1` and should refuse requests from other web pages or hostnames (Host and Origin checks, DNS rebinding).
- Reading or writing files outside the FilmFile folder, through paths, uploads or imported files.
- Anything that changes or deletes original scans and raws, which FilmFile should never do.
- The desktop app's window reaching Node.js or the system, or loading content from elsewhere.
- Exposing the Cloudflare keys used for publishing sites and backups.
- Dependencies and the CI and release workflows (supply chain).

## Known, and not vulnerabilities

- The apps aren't signed yet, so macOS and Windows warn before opening them.
- Someone who can already run programs as you on your computer can read your FilmFile folder.
