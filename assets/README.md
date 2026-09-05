# Solaris Atmosphere Scanner — asset pack

Place this entire `assets` folder at the repository root, beside `src` and `package.json`. It does not replace the starter configuration. Files use lowercase ASCII kebab-case. The live application is not built in this step.

## Inventory

| Folder            | Contents                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `images/weather/` | 14 full-resolution WebP backgrounds, 7 conditions × day/night; 1 neutral SVG fallback                               |
| `fonts/`          | Cormorant Garamond 400/500/600 and Inter 400/500/600/700 in WOFF2; ready-to-import `fonts.css`                      |
| `icons/weather/`  | 12 scalable weather icons including wind, sleet and unknown fallback                                                |
| `icons/ui/`       | 38 scalable controls, metrics and feedback icons                                                                    |
| `branding/`       | Color/monochrome mark, 2 outlined wordmarks, SVG/ICO favicon, 16/32 PNG favicons, 180 touch icon, 192/512 app icons |
| `licenses/`       | Both font OFLs, Lucide ISC and provenance notes                                                                     |

`asset-manifest.json` lists the theme paths. `asset-inventory.json` records file sizes and SHA-256 hashes. Open `asset-catalog.html` locally to review images, fonts and icons. The catalog is a reference document, not an application page to deploy.

## Use with the root assets folder and Webpack

From `src/index.js`, import fonts using `import "../assets/fonts/fonts.css";`.
From `src/styles.css`, a background URL can use `url("../assets/images/weather/weather-clear-day.webp")`.
From a deeper JS module adjust the relative path accordingly. Use explicit image imports or a controlled dynamic-import map so Webpack emits assets; do not rely on bare manifest strings being bundled automatically.

The starter must handle WOFF2, WebP, SVG, PNG and ICO with asset/resource (and CSS with its existing loaders). We will verify that during the next setup step. Favicons must be emitted/copied and linked in template.html; merely storing them here does not activate them. App icons are provided for future metadata and do not imply offline/PWA functionality is implemented.

## Visual usage

- Headings: Cormorant Garamond 500/600. UI and weather values: Inter 400/500/600; 700 sparingly. Use font-display: swap, already included.
- Hero images are decorative. Use empty alt text when rendered with img and expose actual conditions as live text. Keep the illustrative-scenery label. Use cover cropping and check mobile framing; start near 65% 50%.
- Add a dark CSS overlay behind white copy and verify contrast. The image alone is not an accessibility guarantee, especially on snowy scenes.
- UI SVGs use currentColor. Inline the SVG or use it as a CSS mask to inherit text color; an external img will not inherit currentColor from its parent. Label icon-only buttons in HTML and hide redundant inline SVGs from assistive technology.
- Weather SVGs use fixed amber/ivory/blue strokes for predictable external-image rendering. The icon set matches the visual vocabulary but is not a pixel-for-pixel extraction of generated mockups.
- Use solaris-wordmark-on-dark.svg on navy and solaris-wordmark-on-light.svg on pale backgrounds. Wordmarks contain outlines, so they do not require fonts at runtime; give the image a useful brand alt label.
- Render charts, skeleton loaders, temperature bars, compass rotation, sun arc, overlays and feedback panels in HTML/CSS/SVG. They need live data and therefore are not flattened image assets.
- Keep loading/unknown data on the neutral fallback rather than implying clear weather. Day/night must follow the selected location; do not show thunderstorm scenery solely from rain probability.
- The night moon is illustrative, not a lunar-phase indicator. Static backgrounds are suitable for reduced-motion use; do not animate lightning flashes.
- Load only the active hero, not all 14 full images at startup. No external image API is needed.

## Credits

Preserve all supplied third-party licenses. See licenses/asset-provenance.md. Font and icon licenses are supplied verbatim; generated scenery is identified separately.
