# Setting up "Add Project" on Ryan's Mac

One-time setup, done by whoever manages the site (not Ryan). After this,
Ryan just drags a folder onto an app icon.

## 1. Make sure the basics are in place

- The repo is cloned somewhere on Ryan's machine and `git push` already
  works from there (his GitHub credentials are set up).
- Node.js is installed. Check in Terminal: `node -v` (any recent version is fine).
- From the repo folder, run once: `npm install`

## 2. Find where `node` lives

```
which node
```

Note the directory it prints (e.g. `/opt/homebrew/bin` or `/usr/local/bin`).
You'll need it in step 3.

## 3. Configure the AppleScript

Open `scripts/AddProject.applescript` and edit the two `property` lines at
the top:

```applescript
property repoPath : "/Users/ryan/Projects/ryanbir-site"   -- full path to the repo on his machine
property nodeBinDir : "/opt/homebrew/bin"                 -- directory from step 2
```

## 4. Compile it into a double-clickable app

From Terminal, inside the repo:

```
osacompile -o AddProject.app scripts/AddProject.applescript
```

Move `AddProject.app` to Ryan's Desktop (or wherever's convenient). The
`.app` itself doesn't need to live inside the repo — it just needs the
`repoPath` above pointing at wherever the repo actually is.

## 5. Test it once yourself

- Make a scratch folder with a couple of test images (name one `cover.jpg`)
  and a JSON file (copy `src/content/portfolio/_template.json` and fill it in).
- Drag that folder onto `AddProject.app`.
- You should see a confirmation dialog summarizing the project. Publish it,
  confirm it shows up on the live site, then delete the test project
  (ask your site manager, or just revert the commit).

## How Ryan uses it day to day

1. Put his images + one JSON file (copied from `_template.json`, filled in)
   into a single folder. One image must be named `cover` (e.g. `cover.jpg`).
2. Drag that folder onto the `AddProject` app icon (or double-click the app
   and pick the folder from the dialog that appears).
3. A dialog shows what's about to be published — click **Publish** to go
   live, or **Cancel** to back out (nothing is changed if he cancels).
4. A final dialog confirms it went out. The live site updates within a
   couple of minutes via Vercel.

If anything goes wrong, the dialog explains what — usually a fixable
mistake in the JSON (bad category name, missing cover image, etc.) — and
nothing is left half-done in the repo either way.
