# H.1 Host and Origin checks

**Status:** done · **Built in:** 1. Foundations and the API slice

## What was built

Middleware rejecting (403) a `Host` that isn't `localhost`, `127.0.0.1` or `[::1]` on the configured port, and any `Origin` other than the configured UI origin (D1). State-changing methods require a matching `Origin`. API tests for each case. The backend's own address is always an accepted origin; `FILMFILE_UI_ORIGIN` adds one for a separately served UI, which `pnpm dev` sets to Vite's `http://localhost:5173` (Vite's proxy sets the backend's Host; its port is fixed). Tools such as `scripts/upload-roll.sh` send the backend's own address as `Origin`. *(Was 0.6.2.)*
