# Solaris Atmosphere Scanner: module boundaries

Step 2 scaffolds responsibilities only. Empty exports intentionally avoid
pretending unfinished features are working. The starter UI still runs.

| Path                           | Responsibility                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `src/index.js`                 | Browser entry and future controller: connect actions, API, normalization, state, storage, and rendering. |
| `src/template.html`            | Complete document shell; Webpack injects the script.                                                     |
| `src/styles.css`               | Current starter CSS; future design tokens and responsive styles.                                         |
| `src/api/weather.js`           | Fetch raw JSON from the protected endpoint; cancellation and transport errors.                           |
| `src/data/normalizeWeather.js` | Pure provider-to-app transformation; canonical units and explicit missing values.                        |
| `src/state.js`                 | In-memory selection, weather, units, forecast day, loading/errors, and freshness.                        |
| `src/ui/index.js`              | DOM rendering and action callbacks; split views when implemented.                                        |
| `src/utils/`                   | Pure unit, timezone, and condition/asset helpers.                                                        |
| `src/storage.js`               | Versioned preferences, saved/default locations, timestamped cache.                                       |
| `assets/`                      | Existing source imagery, fonts, icons, branding, and licenses.                                           |
| `worker/`                      | Separate protected endpoint; never imported by the browser.                                              |

For a location search, the controller requests raw JSON, normalizes it, updates
state, and renders the state. UI components report actions back to the
controller. Storage and pure helpers never depend on UI components.

## Existing commands preserved

- `npm run dev`: Webpack development server on port 8080.
- `npm run build`: production Webpack bundle in `dist/`.
- `npm run lint`: ESLint across the project.
- `npm run format:check`: Prettier validation.
- `npm run check`: lint, formatting, then production build.
- Existing security commands remain unchanged; Semgrep requires its own install.

Only asset extensions were added to Webpack (SVG and ICO). No dependencies,
package scripts, entry points, or development/production settings were changed.
Worker-specific linting will be added when its implementation exists.

## Applying these files to your local project

Copy the new modules, `worker/README.md`, and this document into your repository.
Review the changes to `webpack.common.js`, `.gitignore`, and `src/template.html`
against any local edits before merging them. Keep your existing `assets/`
contents and README; the checkout placeholder is not a replacement asset pack.
Then run `npm ci` and `npm run check`, followed by `npm run dev` for a browser check.

The inspected starter has pre-existing Prettier warnings in `.prettierrc.json`,
`.vscode/extensions.json`, `.vscode/settings.json`, `README.md`, `src/index.js`,
and `src/styles.css`. These files were left unchanged. If your local checkout
has the same warnings, run `npm run format`, review the formatting-only diff,
and rerun `npm run check`. No browser interaction or proxy deployment has been
tested at this scaffolding stage.
