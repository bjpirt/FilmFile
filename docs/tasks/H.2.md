# H.2 Content type and security headers

**Status:** done · **Built in:** H: Hardening the slice

## What was built

JSON bodies require `Content-Type: application/json` (415 otherwise). Every response gets the CSP, `X-Content-Type-Options`, `frame-ancestors 'none'` and `Referrer-Policy` headers. The scan upload likewise requires `image/jpeg` (the signature check comes in H.4). The docs page's CSP also allows inline styles and `data:` images, which Swagger UI uses; no script exceptions. *(Was 0.6.3.)*
