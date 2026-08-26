# Ryan Bir Site — Claude Code Guide

## Stack
- **Framework**: Astro v5 + Tailwind CSS v3
- **Hosting**: Vercel (auto-deploy from GitHub `main` branch)
- **Domain**: www.ryanbir.com
- **GitHub**: github.com/ryanbircomics

## Project Structure

```
AddProject.app             ← Compiled tool Ryan drags project folders onto
ProjectTemplate.json       ← Copy this to start a new project's JSON (self-documenting)
scripts/                   ← The tool's logic — see "Adding a New Portfolio Project" below
src/
  content/
    config.ts           ← Collection schema (shared with scripts/portfolio-schema.ts)
    portfolio/          ← One .json file per project
  pages/
    index.astro         ← Home page
    portfolio/
      index.astro       ← Portfolio grid
      [slug].astro      ← Individual project page
    about.astro
    contact.astro
  layouts/
    Layout.astro        ← Base HTML wrapper (fonts, meta tags)
  components/
    Nav.astro
    Footer.astro
  styles/
    global.css
public/
  images/
    portfolio/
      [project-folder]/ ← One folder per project, named to match imageFolderLocation
        cover.jpg       ← Required — shown in grid and detail page
        01.jpg          ← Optional additional images
        02.jpg
```

## Adding a New Portfolio Project

Ryan adds new projects himself via the `AddProject` app on his desktop — see
`scripts/SETUP.md` for how it's wired up and `scripts/add-project.ts` for
the logic. It drags-and-drops a folder of images + a JSON file straight
into the right place, processes the images, and publishes via a GUI
confirmation dialog (no terminal, no git).

For manual/technical edits, the same thing can be done by hand or via
`npm run add-project -- prepare <folder>` (see that script's `--dry-run`
flag for safe testing). The content schema lives in
`scripts/portfolio-schema.ts` and is shared between the Astro content
collection (`src/content/config.ts`) and the script — update it there, not
in both places.

Manually, a project is: a folder in `public/images/portfolio/<slug>/`
containing `cover.jpg` (+ optional `01.jpg`, `02.jpg`, ...), and a matching
`src/content/portfolio/<slug>.json` (copy `ProjectTemplate.json` from the
repo root — placeholder text in each field explains what goes there).
`ranking` (lower = shown first) and `imageFolderLocation` are normally auto-filled by
the script, not written by hand.

## Colors

Defined in `tailwind.config.js`:
- `background` #111111 — page background
- `surface` #1A1A1A — cards, inputs
- `accent` #3B82F6 — links, buttons, highlights
- `text` #F5F5F5 — main text
- `muted` #9CA3AF — secondary text, labels

## Contact Form (TODO)

Formspark is wired up (form ID in `src/pages/contact.astro`, submits to
`https://submit-form.com/<id>`, redirects to `/contact/thanks` on success via
a hidden `_redirect` field). Still outstanding: add the Cloudflare Turnstile
script and widget to the form once Ryan sets that up.

## Local Development

```bash
npm install
npm run dev
```

## Deployment

Push to `main` branch → Vercel auto-deploys.
