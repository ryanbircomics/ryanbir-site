# Filling out a project's JSON file

Copy `ProjectTemplate.json` (sitting in the repo's root folder, next to
`AddProject.app`) into the folder with your images. Rename the copy
whatever you like — the name doesn't matter, see below — and fill in the
fields below. Then drag that whole folder onto the `AddProject` app.

| Field | Required? | What to put |
|---|---|---|
| `title` | **Required** | The project's name, e.g. `"Dark Visions"`. |
| `issueNumber` | Optional | A number, only if it's part of a numbered series. Delete the line (or leave it out) if not. |
| `category` | **Required** | One of: `"pencils-inks"`, `"colors"`, `"illustrations"`. See below. |
| `date` | **Required** | Free text — use `DD/MM/YYYY` to match the rest of the site, e.g. `"24/08/2026"`. |
| `role` | **Required** | What you did on it, e.g. `"Pencils, Inks"`. |
| `coCredit` | Optional | A collaborator's name, if there was one. |
| `coCreditLink` | Optional | A link to that collaborator's site. Only used if `coCredit` is filled in, and must be a real link starting with `https://`. |
| `contentLink` | Optional | Where people can read or buy the finished work. Must be a real link starting with `https://`. |

**Leave optional fields as `""` (empty) or delete the line entirely if you're not using them** — both work the same.

Don't add `ranking` or `imageFolderLocation` — the tool fills both of
those in automatically.

## Category values

Type one of these exactly and you can't go wrong:

- `pencils-inks`
- `colors`
- `illustrations`

The tool is a little forgiving about capitalization and spacing (e.g.
`"Pencils & Inks"` also works), but if in doubt, use the exact lowercase
versions above.

## The file name doesn't matter

The tool doesn't care what you call this JSON file — it just looks for
the one `.json` file in the folder, reads it, and creates a properly
named copy inside the website's files based on the title. Your original
file is never touched or moved. There just has to be exactly one `.json`
file in the folder (alongside your images).
