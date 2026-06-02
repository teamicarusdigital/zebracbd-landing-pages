---
name: figma-to-landing-page
description: "Pull section screenshots and assets from Figma via the API, save them locally, then convert them into pixel-perfect HTML/CSS landing pages using a parallel section-by-section build workflow. Use for: Figma export, landing page build, design to code, Figma screenshots, section-based development, pixel-perfect conversion. Triggers: figma, figma to code, figma export, pull from figma, figma api, landing page from figma, figma screenshots, design to html, figma sections, pixel perfect, figma to landing page"
---

# Figma to Landing Page Workflow

Export Figma designs via the API, save screenshots + assets locally, then build pixel-perfect HTML/CSS landing pages section-by-section.

## Before You Start

You need from the user:
- **Figma Personal Access Token** — generate at https://www.figma.com/developers/api#access-tokens
- **Figma File URL** — e.g. `https://www.figma.com/design/ABC123/My-Landing-Page`
- **Target project directory** — where to save exports and build the page

Extract the **File Key** from the URL: `https://www.figma.com/design/{FILE_KEY}/...`

## Phase 1: Figma API Export

### Step 1: Fetch File Metadata

```bash
FIGMA_TOKEN="your-token-here"
FILE_KEY="your-file-key"

# Create export directories
mkdir -p figma-exports reference-screenshots source-images images

# Fetch file metadata
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/$FILE_KEY?depth=1" \
  > figma-exports/figma_file.json
```

### Step 2: Identify Frames (Desktop + Mobile)

Look for the top-level frames in the file. Typically there are two main frames:
- **Desktop** — the full desktop design (usually 1440px wide)
- **Mobile** — the full mobile design (usually 393px wide)

```bash
# Fetch full node tree to find frame IDs
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/$FILE_KEY" \
  > figma-exports/figma_nodes.json
```

Parse the JSON to find the top-level frame node IDs. Then fetch full data for each:

```bash
# Fetch desktop frame (replace DESKTOP_NODE_ID)
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/$FILE_KEY/nodes?ids=DESKTOP_NODE_ID" \
  > figma-exports/figma_desktop_full.json

# Fetch mobile frame (replace MOBILE_NODE_ID)
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/$FILE_KEY/nodes?ids=MOBILE_NODE_ID" \
  > figma-exports/figma_mobile_full.json
```

### Step 3: Export Section Screenshots

Identify each section's frame/group node ID from the node tree. Then export them as PNGs at 2x scale:

```bash
# Export specific nodes as PNG images (comma-separated node IDs)
# Replace NODE_IDS with comma-separated section node IDs
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/images/$FILE_KEY?ids=NODE_IDS&format=png&scale=2" \
  > figma-exports/figma_images.json
```

This returns S3 URLs for each node. Download them:

```bash
# Parse the image URLs from figma_images.json and download each
# Name them: section-{N}-desktop.png / section-{N}-mobile.png
curl -o reference-screenshots/section-0-desktop.png "S3_URL_HERE"
curl -o reference-screenshots/section-0-mobile.png "S3_URL_HERE"
# ... repeat for each section
```

**Naming convention:** `section-{N}-{breakpoint}.png`
- Breakpoints: `desktop` and `mobile`
- Example: `section-0-desktop.png`, `section-3-mobile.png`

### Step 4: Export Image Assets

For component images (logos, icons, product photos, backgrounds), identify the image fill node IDs and export:

```bash
# Export image assets
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/images/$FILE_KEY?ids=IMAGE_NODE_IDS&format=png&scale=2" \
  > figma-exports/figma_exports.json
```

Download each to `source-images/` then copy optimized versions to `images/`:

```bash
# Download assets
curl -o source-images/logo.png "S3_URL"
curl -o source-images/hero-bg.png "S3_URL"

# Copy to production images folder
cp source-images/*.png images/
```

## Phase 2: Project Setup

### Step 1: Create CLAUDE.md

Create a `CLAUDE.md` in the project root with build rules. Key sections:

```markdown
# Project Name — Agent Instructions

## Mission
Recreate the landing page as a pixel-perfect 1:1 copy of the Figma section screenshots.
Screenshots in reference-screenshots/ are the single source of truth.

## Critical Rules
- Match EXACT font sizes, weights, line-heights, colors from screenshots
- Match EXACT spacing (padding, margin, gap)
- Mobile-first CSS, single breakpoint: @media (min-width: 768px)
- All classes prefixed with gh- (or project prefix), scoped under .gh-root
- All sizes in px (not rem/em)

## Section Index
| # | Section Name | Description |
|---|---|---|
| 0 | Hero | Navigation + hero content |
| 1 | Features | Feature cards |
| ... | ... | ... |

## Color Palette
(Extract from Figma or screenshots)

## Fonts
(List Google Fonts families and weights used)
```

### Step 2: Create HTML Shell

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Page Title</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="GOOGLE_FONTS_URL" rel="stylesheet">
<style>
/* Global resets */
.gh-root { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', sans-serif; }
.gh-root *, .gh-root *::before, .gh-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.gh-root img { max-width: 100%; display: block; }

/* Section styles will be added here */
</style>
</head>
<body>
<div class="gh-root">
  <!-- Sections will be assembled here -->
</div>
</body>
</html>
```

## Phase 3: Parallel Section Builds

Each section is built independently by reading its desktop + mobile screenshot. Sections can be built in parallel.

### Per-Section Build Process

For each section:

1. **Read the screenshots** — Read `reference-screenshots/section-{N}-desktop.png` and `section-{N}-mobile.png`
2. **Measure everything** from the screenshot:
   - Font: family, size, weight, style, line-height, color, letter-spacing
   - Spacing: padding, margin, gap
   - Dimensions: width, height, constraints
   - Borders: width, style, color, radius
   - Background: color, gradient, image
   - Layout: flex vs grid, direction, alignment
3. **Write mobile-first CSS** — base styles = mobile layout
4. **Add desktop overrides** — `@media (min-width: 768px)` block
5. **Write semantic HTML** — `<section>`, proper headings, alt text on images
6. **Use BEM-like naming** — `.gh-section__element--modifier`

### Output Format Per Section

```html
<!-- SECTION N: Section Name -->
<style>
/* Mobile-first base styles */
.gh-sectionname { ... }
.gh-sectionname__element { ... }

@media (min-width: 768px) {
  .gh-sectionname { ... }
}
</style>

<section class="gh-sectionname">
  ...
</section>
```

## Phase 4: Assembly

1. Combine all section CSS into the single `<style>` block
2. Combine all section HTML inside `<div class="gh-root">`
3. Verify:
   - No duplicate styles
   - All images referenced correctly with `/images/filename.png`
   - All images have `loading="lazy"` (except hero/above-fold)
   - No horizontal scroll on any breakpoint

## Phase 5: Deploy & Iterate

1. Deploy to hosting (Vercel, Netlify, etc.)
2. Test on real devices (mobile, tablet, desktop)
3. Fix any responsive issues
4. Add JavaScript features (carousels, accordions, etc.)
5. Add tracking (pixels, UTM forwarding — see `/tracklution-pixel` and `/utm-forwarder` skills)

## CSS Standards Quick Reference

| Rule | Standard |
|------|----------|
| Units | Always `px`, never rem/em |
| Mobile first | Base styles = mobile, `@media (min-width: 768px)` = desktop |
| Class prefix | `gh-` (or project-specific prefix) |
| Naming | BEM-like: `.gh-section__element--modifier` |
| Max width | 1440px centered |
| Mobile padding | 16px horizontal |
| Desktop padding | 80-160px horizontal |
| Images | `max-width: 100%; display: block; loading="lazy"` |
| No !important | Unless absolutely necessary for specificity |
| Inline CSS | All styles in single `<style>` block in `<head>` |

## Figma API Quick Reference

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/files/{key}` | Full file with node tree |
| `GET /v1/files/{key}?depth=1` | File metadata only |
| `GET /v1/files/{key}/nodes?ids={ids}` | Specific node details |
| `GET /v1/images/{key}?ids={ids}&format=png&scale=2` | Export nodes as PNG |
| Header: `X-Figma-Token: {token}` | Auth for all requests |

**Rate limits:** 30 requests/minute. Add 2-second delays between batch calls.

## Directory Structure Template

```
project-root/
├── CLAUDE.md                    — Build rules and section index
├── index.html                   — Final assembled page
├── vercel.json                  — Deployment config (if using Vercel)
├── images/                      — Production images (committed)
├── reference-screenshots/       — Figma section PNGs (gitignored)
│   ├── section-0-desktop.png
│   ├── section-0-mobile.png
│   └── ...
├── source-images/               — Raw Figma image exports (gitignored)
└── figma-exports/               — Figma API JSON responses (gitignored)
    ├── figma_file.json
    ├── figma_nodes.json
    ├── figma_desktop_full.json
    ├── figma_mobile_full.json
    └── figma_images.json
```

**Remember to .gitignore:**
```
reference-screenshots/
source-images/
figma-exports/
```

These are large files used only during development, not needed in production.
