# Solaris weather proxy

Start with [the step-four setup guide](../STEP-04.md). It covers local setup,
private secrets, quota checks, Cloudflare deployment, and endpoint verification.

This folder is a separate npm project and is never imported into `src/`.
Its `build` script validates a deployment bundle without publishing it.
The production endpoint starts disabled until you configure and enable it.

Run from the parent project root:

```bash
npm --prefix worker ci
npm --prefix worker test
npm --prefix worker run build
```

Only `.dev.vars.example` may be committed; your real `.dev.vars` is ignored.
Unit tests use a fake credential and never make provider requests.
