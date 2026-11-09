# H.3 Error handler

**Status:** done · **Built in:** 1. Foundations and the API slice

## What was built

Unexpected errors return a generic 500 with a correlation ID, logged server-side; no stack trace or path in the response. *(Was 0.6.4.)*
