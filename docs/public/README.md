# Static assets (`docs/public/`)

Files here are served from the site root, e.g. `logo.svg` → `/Fixed-Income-Analytics/logo.svg`.

- **`logo.svg`** — favicon + nav logo. Used directly.
- **`og-image.svg`** — source for the social-share card.

## Generating `og-image.png`

Social platforms (Slack, X/Twitter, LinkedIn) render PNG/JPG for link previews,
not SVG, so the `og:image` meta points at `og-image.png`. Generate it once from
the SVG and commit the PNG here (1200×630):

```bash
# any one of these:
npx sharp-cli -i og-image.svg -o og-image.png resize 1200 630
# or, with ImageMagick installed:
magick og-image.svg -resize 1200x630 og-image.png
# or open og-image.svg in a browser/Figma and export at 1200×630.
```

Until the PNG exists the meta tag simply resolves to a 404 on social scrapers —
harmless, but the card won't render an image. Everything else works.
