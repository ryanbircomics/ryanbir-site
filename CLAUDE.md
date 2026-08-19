# Ryan Bir Site — Claude Code Guide

## Stack
- **Framework**: Astro v5 + Tailwind CSS v3
- **Hosting**: Vercel (auto-deploy from GitHub `main` branch)
- **Domain**: www.ryanbir.com
- **GitHub**: github.com/ryanbircomics

## Project Structure

```
src/
  content/
    config.ts           ← Collection schema (do not edit unless adding new fields)
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
    ProjectCard.astro   ← Card used in portfolio grid and home page
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

1. Create a folder in `public/images/portfolio/` — e.g. `public/images/portfolio/my-project/`
2. Add `cover.jpg` (and any additional images named `01.jpg`, `02.jpg`, etc.)
3. Create `src/content/portfolio/my-project.json` with this structure:

```json
{
  "title": "Project Title",
  "issueNumber": 1,
  "date": "DD/MM/YYYY",
  "role": "Pencils & Inks",
  "coCredit": "Collaborator Name",
  "coCreditLink": "https://collaboratorsite.com",
  "contentLink": "https://link-to-buy-or-read.com",
  "imageFolderLocation": "images/portfolio/my-project",
  "ranking": 2
}
```

- `issueNumber`, `coCredit`, `coCreditLink`, `contentLink` are all optional
- `ranking`: lower number = shown first. Use 1 for your most important work.

## Colors

Defined in `tailwind.config.js`:
- `background` #111111 — page background
- `surface` #1A1A1A — cards, inputs
- `accent` #3B82F6 — links, buttons, highlights
- `text` #F5F5F5 — main text
- `muted` #9CA3AF — secondary text, labels

## Contact Form (TODO)

When Ryan sets up Formspark + Cloudflare Turnstile:
1. Replace `YOUR_FORM_ID_HERE` in `src/pages/contact.astro`
2. Add the Turnstile script and widget to the form

## Local Development

```bash
npm install
npm run dev
```

## Deployment

Push to `main` branch → Vercel auto-deploys.
