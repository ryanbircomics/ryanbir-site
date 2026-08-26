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

`AddProject.app` is already committed to the repo root, pre-compiled — no
`osacompile` step needed on Ryan's machine. It works wherever it ends up
because it figures out the repo location and where `node` lives at
runtime, not at compile time. Cloning/pulling the repo is enough.

## 2. Give Ryan a normal-looking icon

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

## 3. Test it once yourself

- Make a scratch folder with a couple of test images (name one `cover.jpg`)
  and a JSON file (copy `ProjectTemplate.json` from the repo root and fill it in).
- Drag that folder onto the Desktop alias.
- You should see a confirmation dialog summarizing the project. Publish it,
  confirm it shows up on the live site, then delete the test project
  (ask your site manager, or just revert the commit).

## How Ryan uses it day to day

**Adding a new project or replacing one's images:**

1. Put his images + one JSON file (copied from `ProjectTemplate.json` in
   the repo root, with placeholder text in each field showing what goes
   there) into a single folder. One image must have "cover" somewhere in
   its filename (e.g. `cover.jpg`, or `dark souls 01 cover.jpg`).
2. Drag that folder onto the `AddProject` icon on his Desktop (or
   double-click it and choose "Project folder" from the dialog that
   appears).
3. A dialog shows what's about to be published — click **Publish** to go
   live, or **Cancel** to back out (nothing is changed if he cancels).
4. A final dialog confirms it went out. The live site updates within a
   couple of minutes via Vercel.

If the title, issue number, and category all exactly match an existing
project, this **replaces** it (images included) instead of creating a
duplicate.

**Updating an existing project's info without touching its images:**

Drag just a JSON file (no folder, no images) onto the icon instead — or
double-click and choose "JSON file (update info only)". It must match an
existing project's title/issue number/category exactly; the dialog then
updates that project's info (role, date, links, etc.) and leaves its
images exactly as they are.

**"Deleting" a project:**

There's no real delete — instead, take that project's JSON (drag just the
JSON file in, as above), set `"hidden": true`, and submit it the same way.
The project stops appearing anywhere on the site, but nothing is actually
removed — set `"hidden": false` (or drop the field entirely) the same way
to bring it back.

If anything goes wrong, the dialog explains what — usually a fixable
mistake in the JSON (bad category name, missing cover image, no matching
existing project for a JSON-only update, etc.) — and nothing is left
half-done in the repo either way.

## If you update the tool itself later

- Changes to `scripts/add-project.ts`, `scripts/add-project-core.ts`, or
  `scripts/portfolio-schema.ts` reach Ryan automatically — the tool pulls
  latest from GitHub as its first step every time it runs, and installs
  any new dependencies itself.
- Changes to `scripts/AddProject.applescript` (the dialogs themselves) do
  **not** update automatically — `AddProject.app` in the repo root is a
  compiled snapshot of that file, committed to git. Recompile it on your
  own machine and commit the result in the same change:

  ```
  osacompile -o AddProject.app scripts/AddProject.applescript
  git add scripts/AddProject.applescript AddProject.app
  git commit -m "..."
  ```

  Ryan's copy updates automatically the next time he runs the tool (it's
  just a normal file pulled from the repo, same as any other). Don't skip
  recompiling after editing the `.applescript` source — otherwise the
  source and the committed `.app` drift out of sync and Ryan keeps seeing
  the old dialogs.
