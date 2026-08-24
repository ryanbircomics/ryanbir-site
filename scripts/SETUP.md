# Setting up "Add Project" on Ryan's Mac

One-time setup, done by whoever manages the site (not Ryan). After this,
Ryan just drags a folder onto an app icon — no properties to edit, no
paths to type in.

## 1. Make sure the basics are in place

- The repo is cloned somewhere on Ryan's machine and `git push` already
  works from there (his GitHub credentials are set up).
- Node.js is installed. Check in Terminal: `node -v` (any recent version is fine).
- From the repo folder, run once: `npm install`
  (Only needed this first time — the tool checks for and installs any
  future new dependencies itself before it runs.)

## 2. Compile the app

From Terminal, inside the repo:

```
osacompile -o AddProject.app scripts/AddProject.applescript
```

This creates `AddProject.app` in the repo's root folder. Leave it there —
the app figures out where the repo is by asking where it itself is
running from, so it needs to live inside it. (It's already covered by
`.gitignore`, so it won't get committed.)

## 3. Give Ryan a normal-looking icon

The app itself should stay inside the repo folder, but Ryan doesn't need
to go digging through the project files to find it. Make an alias on his
Desktop instead:

- Hold **Cmd+Option** and drag `AddProject.app` onto the Desktop. This
  creates a shortcut there (look for the little arrow badge on the icon)
  without moving the real file.

Aliases keep working even if the repo folder gets renamed or moved,
as long as macOS can still find it via Spotlight — but if the repo folder
is ever moved to a completely different drive/location, it's safest to
just redo this step.

## 4. Test it once yourself

- Make a scratch folder with a couple of test images (name one `cover.jpg`)
  and a JSON file (copy `src/content/portfolio/_template.json` and fill it in).
- Drag that folder onto the Desktop alias.
- You should see a confirmation dialog summarizing the project. Publish it,
  confirm it shows up on the live site, then delete the test project
  (ask your site manager, or just revert the commit).

## How Ryan uses it day to day

1. Put his images + one JSON file (copied from `_template.json`, filled in)
   into a single folder. One image must be named `cover` (e.g. `cover.jpg`).
2. Drag that folder onto the `AddProject` icon on his Desktop (or
   double-click it and pick the folder from the dialog that appears).
3. A dialog shows what's about to be published — click **Publish** to go
   live, or **Cancel** to back out (nothing is changed if he cancels).
4. A final dialog confirms it went out. The live site updates within a
   couple of minutes via Vercel.

If anything goes wrong, the dialog explains what — usually a fixable
mistake in the JSON (bad category name, missing cover image, etc.) — and
nothing is left half-done in the repo either way.

## If you update the tool itself later

- Changes to `scripts/add-project.ts`, `scripts/add-project-core.ts`, or
  `scripts/portfolio-schema.ts` reach Ryan automatically — the tool pulls
  latest from GitHub as its first step every time it runs, and installs
  any new dependencies itself.
- Changes to `scripts/AddProject.applescript` (the dialogs themselves) do
  **not** update automatically — the `.app` is a compiled snapshot of that
  file. Recompile it (step 2) and it'll pick up the change immediately
  since the app stays in place and the Desktop alias still points to it.
