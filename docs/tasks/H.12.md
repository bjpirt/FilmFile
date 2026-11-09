# H.12 Full CI and dependency updates

**Status:** done · **Built in:** 1. Foundations and the API slice

## What was built

Build, Playwright smoke test, `pnpm audit --audit-level high`, gitleaks, CodeQL (the repository is public), a macOS job for sharp; Dependabot including Actions SHAs; a lint-staged pre-commit hook. *(Was 0.6.5–0.6.7.)* CI jobs: verify and build on Ubuntu and macOS, the Playwright smoke test (`test/e2e/`, the S2.6 journey against the built UI), `pnpm audit`, and gitleaks over the whole history; CodeQL in its own workflow, weekly too. Dependabot has a 3-day cooldown to match `minimumReleaseAge`. The pre-commit hook is a few lines of shell in `.githooks/`, not lint-staged, and only checks.
