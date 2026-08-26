# Ryan Bir Site — Claude Code Guide

## Stack
- **Framework**: Astro v5 + Tailwind CSS v3
- **Hosting**: Vercel (auto-deploy from GitHub `main` branch)
- **Domain**: www.ryanbir.com
- **GitHub**: github.com/ryanbircomics/ryanbir-site

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
    contact.astro       ← Formspark contact form
    contact/
      thanks.astro     ← Post-submit redirect target
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
        cover.jpg       ← One image must have "cover" in its filename (shown in grid and detail page)
        01.jpg          ← Optional additional images
        02.jpg
```

## Adding a New Portfolio Project

Ryan adds new projects himself via the `AddProject` app on his desktop — see
`scripts/SETUP.md` for how it's wired up and `scripts/add-project.ts` for
the logic. It drags-and-drops a folder of images + a JSON file straight
into the right place, processes the images, and publishes via a GUI
confirmation dialog (no terminal, no git).

For manual/technical edits, the same thing can be done by hand via
`npm run add-project -- prepare <folder|jsonFile>` (stages locally, doesn't
commit or push), then either `npm run add-project -- commit <slug>` (add
`--dry-run` to commit locally without pushing, for safe testing) or
`npm run add-project -- abort <slug>` to cancel and restore the previous
state. The content schema lives in `scripts/portfolio-schema.ts` and is
shared between the Astro content collection (`src/content/config.ts`) and
the script — update it there, not in both places.

Manually, a project is: a folder in `public/images/portfolio/<slug>/`
containing one image with "cover" somewhere in its filename (case-insensitive
substring match, e.g. `cover.jpg` or `dark souls 01 cover.jpg` — exactly one
match required) plus optional others, and a matching
`src/content/portfolio/<slug>.json` (copy `ProjectTemplate.json` from the
repo root — placeholder text in each field explains what goes there).

`ranking` (lower = shown first) is filled in by hand in the template — its
placeholder text is deliberately not a valid number, so the script's own
validation catches it if left unedited (same trick as `category`'s
placeholder). `imageFolderLocation` is the one field still auto-filled by
the script, not written by hand.

**Updating an existing project without touching its images**: drop just a
JSON file (no folder, no images) — it must match an existing project's
title/issueNumber/category exactly, and updates that project's other
fields while leaving its images and `imageFolderLocation` untouched. A
JSON-only drop that doesn't match anything existing fails (there's no way
to create a new project without images).

**Hiding a project ("soft delete")**: set `"hidden": true` in a project's
JSON and resubmit it (a JSON-only drop works fine for this — no need to
touch images). A hidden project is filtered out of every `getCollection`
call across the site (home/category cards, category listings, and its own
detail page's `getStaticPaths`), so its page isn't even generated — nothing
is deleted, it's just unreachable until `hidden` is set back to `false`.

## Colors

Defined in `tailwind.config.js`:
- `background` #111111 — page background
- `surface` #1A1A1A — cards, inputs
- `accent` #3B82F6 — links, buttons, highlights
- `text` #F5F5F5 — main text
- `muted` #9CA3AF — secondary text, labels

## UI Conventions

- **Load animation**: `animate-fade-in-up` (defined in `tailwind.config.js`)
  runs two independent keyframe animations together — `fadeIn` (2.2s) and
  `slideUp` (1.2s) — so the fade can be tuned separately from the upward
  motion. Applied to the home/portfolio category cards, every portfolio
  image, the project cover image, and the About page's photo placeholder
  (so the real portrait picks it up automatically once added). No stagger —
  everything on a page animates in together on purpose.
- **Lightbox**: clicking an image in a project's grid (on a category page,
  `src/pages/portfolio/[slug].astro`) opens a fullscreen lightbox with
  prev/next arrows, an X to close, click-outside-to-close, and arrow-key/
  Escape support. Plain vanilla JS in a `<script>` tag, scoped per-project
  via `data-lightbox-group`/`data-lightbox-img` attributes — no library.
- **Title formatting**: when a project has an `issueNumber`, the displayed
  title is `"{title} · Issue #{issueNumber}"` (dot separator, "Issue #" not
  just "#"). See `displayTitle` in `[slug].astro` (defined twice — once per
  branch of the category/project conditional).
- **Date is hidden**: `date` stays in the schema/JSON (client wants it kept
  for future use) but isn't rendered anywhere currently — removed from both
  the category and individual project pages per client request.
- **Co-credit links**: styled to inherit the surrounding text color and use
  an underline, not `text-accent` — an accent-blue link there pulled focus
  away from Ryan's own credit.

## Contact Form

Formspark is wired up (form ID in `src/pages/contact.astro`, submits to
`https://submit-form.com/<id>`, redirects to `/contact/thanks` on success via
a hidden `_redirect` field). Fields: Name, Email, Phone, Subject, Message —
all required except Phone.

## Outstanding Technical Work

- **Cloudflare Turnstile (spam protection for the contact form)** — waiting
  on Ryan to create his own free Cloudflare account (Turnstile doesn't need
  the domain's DNS/nameservers to move to Cloudflare, so this is just a
  signup). Once he has a sitekey + secret key, add the Turnstile script and
  widget to `src/pages/contact.astro` and configure the secret in Formspark.
- **Branded email (`ryan@ryanbir.com` via iCloud Mail)** — needs an
  Apple ID with iCloud+ (for iCloud's custom domain feature) and a few DNS
  records added at wherever `ryanbir.com`'s DNS is managed, per Apple's
  custom domain setup flow.
- **SEO optimization** — already in place: sitemap (`@astrojs/sitemap`,
  `site` set in `astro.config.mjs`), per-page `<title>`/meta description,
  canonical URL, and basic Open Graph tags (all via `Layout.astro`). Still
  to do: `robots.txt`, structured data (e.g. Person/CreativeWork schema),
  and an alt-text pass on portfolio images (currently auto-generated as
  `"{title} — {filename}"`, not hand-written).
- **Google Analytics (GA4)** — not yet added; needs a GA4 property/measurement
  ID from Ryan, then the tracking snippet added to `Layout.astro`.

## Local Development

```bash
npm install
npm run dev
```

## Deployment

Push to `main` branch → Vercel auto-deploys.
