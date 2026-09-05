# Protected weather endpoint

This folder is reserved for the separately deployed server-side proxy.
There is deliberately no working endpoint or deployment configuration yet.

- Store the Visual Crossing key as a server-side secret, never in `src/`,
  browser environment replacements, assets, or committed configuration.
- Never import this folder from `src/`. The browser's sole Webpack entry remains
  `src/index.js`; this folder is not part of that dependency graph.
- The future endpoint will validate locations/coordinates, call a fixed provider
  URL, cache responses, limit abuse, and return safe errors without secret URLs.
- CORS is not authentication or a substitute for rate limiting.
- Local `.dev.vars` and `.wrangler/` files are ignored by Git.
- Add Worker-specific scripts, runtime lint globals, tests, and deployment
  configuration when implementing the proxy, not to the browser build.
