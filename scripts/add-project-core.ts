// The real logic behind "add a portfolio project", loaded by scripts/add-project.ts
// once it's confirmed dependencies are installed. Not meant to be run directly.
// Invoked as three phases so a GUI wrapper can pause for confirmation between
// processing and publishing:
//   prepare <sourceFolder>  — pull, validate, process images, write + stage files
//   commit  <slug>          — git commit + push
//   abort   <slug>          — undo prepare, leaving the repo clean
//
// See scripts/SETUP.md for how this is wired up to a double-clickable app.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  portfolioSchema,
  sourceSchema,
  CATEGORIES,
  slugify,
  normalizeCategory,
} from "./portfolio-schema";

const REPO_ROOT = process.cwd();
const PORTFOLIO_CONTENT_DIR = path.join(REPO_ROOT, "src/content/portfolio");

// Guards against two runs (e.g. an impatient double-drag) touching the repo
// at once. There's no single process spanning "prepare ran, now waiting on
// the confirmation dialog" — each phase is its own short-lived process — so
// this can't be a PID-liveness check; it's a timestamp with a generous
// timeout instead, so an interrupted run (crash, force-quit, closed lid)
// always self-heals instead of permanently locking Ryan out.
const LOCK_PATH = path.join(REPO_ROOT, ".add-project.lock");
const LOCK_STALE_AFTER_MS = 20 * 60 * 1000;

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"]);
const IGNORED_FILES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

const MAX_DIMENSION = 2400;
const JPEG_QUALITY = 85;

class AddProjectError extends Error {}

function fail(message: string): never {
  throw new AddProjectError(message);
}

function relFromRoot(p: string): string {
  return path.relative(REPO_ROOT, p);
}

// Every subprocess call goes through this so stderr is always captured, not
// inherited — "do shell script" (the GUI wrapper) reads whatever lands on
// our own stderr as the error message, and a raw git/npm error bleeding
// through there would bury our own friendlier message underneath it.
function run(cmd: string, args: string[]): Buffer {
  return execFileSync(cmd, args, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
}

function git(args: string[]): string {
  try {
    return run("git", args).toString().trim();
  } catch (err) {
    const stderr = (err as any).stderr ? (err as any).stderr.toString().trim() : String(err);
    fail(`git ${args.join(" ")} failed: ${stderr}`);
  }
}

function ensureCleanRepo() {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main") {
    fail(`You're on branch "${branch}", not "main". Switch to main and try again.`);
  }
  const status = git(["status", "--porcelain"]);
  if (status) {
    fail("Your local copy has unsaved changes. Please contact your site manager before adding a new project.");
  }
}

function pullLatest() {
  try {
    run("git", ["pull", "--ff-only", "origin", "main"]);
  } catch (err) {
    const stderr = (err as any).stderr ? (err as any).stderr.toString().toLowerCase() : "";
    const looksOffline = [
      "could not resolve host",
      "could not read from remote repository",
      "connection timed out",
      "network is unreachable",
      "failed to connect",
      "operation timed out",
      "unable to access",
    ].some((s) => stderr.includes(s));

    if (looksOffline) {
      fail("Couldn't reach GitHub — check your internet connection and try again.");
    }
    fail("Couldn't update from GitHub (your copy may have diverged). Please contact your site manager.");
  }
}

function acquireLock() {
  if (fs.existsSync(LOCK_PATH)) {
    const startedAt = Number(fs.readFileSync(LOCK_PATH, "utf-8").trim());
    const age = Date.now() - startedAt;
    if (Number.isFinite(age) && age >= 0 && age < LOCK_STALE_AFTER_MS) {
      fail("Add Project is already running — maybe a confirmation dialog is open somewhere? Finish or cancel that one first.");
    }
  }
  fs.writeFileSync(LOCK_PATH, String(Date.now()));
}

function releaseLock() {
  fs.rmSync(LOCK_PATH, { force: true });
}

function readSourceFolder(sourceDir: string) {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const jsonFiles: string[] = [];
  const imageFiles: string[] = [];
  const unknownFiles: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      unknownFiles.push(`${entry.name}/ (folders aren't supported here)`);
      continue;
    }
    const lower = entry.name.toLowerCase();
    if (lower.startsWith(".") || IGNORED_FILES.has(lower)) continue;

    const ext = path.extname(lower);
    if (ext === ".json") {
      jsonFiles.push(entry.name);
    } else if (IMAGE_EXTENSIONS.has(ext)) {
      imageFiles.push(entry.name);
    } else {
      unknownFiles.push(entry.name);
    }
  }

  if (unknownFiles.length) {
    fail(
      `This folder has files I don't know how to handle:\n${unknownFiles.join("\n")}\n\nRemove them (or save images as JPG/PNG) and try again.`
    );
  }
  if (jsonFiles.length === 0) fail("No JSON file found in this folder.");
  if (jsonFiles.length > 1) {
    fail(`Found more than one JSON file (${jsonFiles.join(", ")}) — there should be exactly one.`);
  }
  if (imageFiles.length === 0) fail("No image files found in this folder.");

  return { jsonFile: jsonFiles[0], imageFiles };
}

function readProjectJson(sourceDir: string, jsonFile: string) {
  const raw = fs.readFileSync(path.join(sourceDir, jsonFile), "utf-8");
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    fail(`${jsonFile} isn't valid JSON: ${(err as Error).message}`);
  }

  // Treat blank values left over from the template as "not provided" — the
  // point is he can leave an unused optional field sitting right there
  // rather than having to delete the line.
  for (const key of ["issueNumber", "coCredit", "coCreditLink", "contentLink"]) {
    if (typeof data[key] === "string" && data[key].trim() === "") {
      delete data[key];
    }
  }

  if (typeof data.category === "string") {
    const normalized = normalizeCategory(data.category);
    if (!normalized) {
      fail(
        `"${data.category}" isn't a recognized category. Use one of: ${CATEGORIES.map((c) => c.slug).join(", ")}`
      );
    }
    data.category = normalized;
  }

  const parsed = sourceSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    fail(`${jsonFile} has some problems:\n${issues}`);
  }
  return parsed.data;
}

function nextRanking(category: string): number {
  if (!fs.existsSync(PORTFOLIO_CONTENT_DIR)) return 1;
  const files = fs
    .readdirSync(PORTFOLIO_CONTENT_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"));

  let max = 0;
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PORTFOLIO_CONTENT_DIR, f), "utf-8"));
      if (data.category === category && typeof data.ranking === "number") {
        max = Math.max(max, data.ranking);
      }
    } catch {
      // an existing file being unreadable isn't this run's problem
    }
  }
  return max + 1;
}

type ExistingProject = {
  jsonSlug: string;
  category: string;
  imageFolderLocation: string;
  ranking: number;
};

// A project's identity is title + issue number + category, all three. The
// same title (even the same title + issue number) can legitimately exist
// as separate, independent projects in different categories — so only an
// exact match on all three counts as "the same project" to update; a
// title/issue match in a different category is simply unrelated.
function findExistingProject(title: string, issueNumber: number | undefined, category: string): ExistingProject | null {
  if (!fs.existsSync(PORTFOLIO_CONTENT_DIR)) return null;
  const files = fs
    .readdirSync(PORTFOLIO_CONTENT_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"));

  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PORTFOLIO_CONTENT_DIR, f), "utf-8"));
      const sameTitle = typeof data.title === "string" && data.title.trim().toLowerCase() === title.trim().toLowerCase();
      const sameIssue = (data.issueNumber ?? undefined) === (issueNumber ?? undefined);
      const sameCategory = data.category === category;
      if (sameTitle && sameIssue && sameCategory) {
        return {
          jsonSlug: f.replace(/\.json$/, ""),
          category: data.category,
          imageFolderLocation: data.imageFolderLocation,
          ranking: data.ranking,
        };
      }
    } catch {
      // an existing file being unreadable isn't this run's problem
    }
  }
  return null;
}

// Decides where this submission lands: on top of an existing project (an
// update — exact match on title, issue number, and category) or as a
// brand-new one. Since two projects with the same title/issue can now
// coexist in different categories, the plain title-derived slug can
// collide even though this isn't a duplicate — in that case the category
// gets folded into the slug to disambiguate, rather than blocking.
function resolveTarget(title: string, issueNumber: number | undefined, category: string) {
  const existing = findExistingProject(title, issueNumber, category);

  if (existing) {
    return {
      jsonSlug: existing.jsonSlug,
      imageFolderLocation: existing.imageFolderLocation,
      isReplace: true,
      existingRanking: existing.ranking as number | undefined,
    };
  }

  const baseSlug = slugify(title, issueNumber);
  if (!baseSlug) {
    fail("Couldn't build a name from the title — try a title with letters or numbers in it.");
  }

  let jsonSlug = baseSlug;
  if (fs.existsSync(path.join(PORTFOLIO_CONTENT_DIR, `${jsonSlug}.json`))) {
    // Taken — most likely the same title/issue already exists in a
    // different category. Disambiguate by category instead of blocking.
    jsonSlug = `${baseSlug}-${category}`;
    if (fs.existsSync(path.join(PORTFOLIO_CONTENT_DIR, `${jsonSlug}.json`))) {
      fail(`Couldn't find a unique name for this project. Contact your site manager.`);
    }
  }

  return {
    jsonSlug,
    imageFolderLocation: `images/portfolio/${jsonSlug}`,
    isReplace: false,
    existingRanking: undefined as number | undefined,
  };
}

function organizeImages(imageFiles: string[]) {
  const coverCandidates = imageFiles.filter((f) => path.parse(f).name.toLowerCase().includes("cover"));
  if (coverCandidates.length === 0) {
    fail(
      'No cover image found. Make sure "cover" is somewhere in one image\'s file name (e.g. "cover.jpg" or "dark souls 01 cover.jpg") — it\'ll be used as the main image.'
    );
  }
  if (coverCandidates.length > 1) {
    fail(
      `Found more than one image with "cover" in its name (${coverCandidates.join(", ")}) — rename so only one does.`
    );
  }
  const coverFile = coverCandidates[0];
  const rest = imageFiles.filter((f) => f !== coverFile).sort((a, b) => a.localeCompare(b));
  return { coverFile, rest };
}

async function processImage(srcPath: string, destPath: string) {
  await sharp(srcPath)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(destPath);
}

function runBuildCheck() {
  try {
    run("npm", ["run", "build"]);
  } catch (err) {
    const output = ((err as any).stdout?.toString() ?? "") + ((err as any).stderr?.toString() ?? "");
    fail(`The site failed to build with this project's data — nothing was saved:\n${output.slice(-2000)}`);
  }
}

// Undoes whatever prepare() (or a previous run) wrote for this project,
// whether it's a failure mid-prepare or the user clicking Cancel. Critical
// distinction: if this project already existed at HEAD (an update), we must
// *restore* it to exactly what was last committed, never just delete it —
// these are live files, and deleting them would wipe out the currently-
// published version over what should be a no-op cancellation. Only a
// genuinely new project (never committed before) is safe to just delete.
function cleanupSlug(jsonSlug: string, imageFolderLocation: string) {
  const destImagesDir = path.join(REPO_ROOT, "public", imageFolderLocation);
  const destJsonPath = path.join(PORTFOLIO_CONTENT_DIR, `${jsonSlug}.json`);
  const jsonRel = relFromRoot(destJsonPath);
  const imagesRel = relFromRoot(destImagesDir);

  let existedAtHead = false;
  try {
    run("git", ["cat-file", "-e", `HEAD:${jsonRel}`]);
    existedAtHead = true;
  } catch {
    existedAtHead = false;
  }

  if (existedAtHead) {
    try {
      run("git", ["restore", "--staged", "--worktree", "--", imagesRel, jsonRel]);
    } catch {
      // nothing was staged/changed yet — fine
    }
    try {
      run("git", ["clean", "-fd", "--", imagesRel]);
    } catch {
      // no new untracked files to remove — fine
    }
  } else {
    try {
      run("git", ["restore", "--staged", "--", imagesRel, jsonRel]);
    } catch {
      // may not have been staged yet — fine
    }
    fs.rmSync(destImagesDir, { recursive: true, force: true });
    fs.rmSync(destJsonPath, { force: true });
  }
}

async function prepare(sourceDir: string) {
  // If this throws (something else is already running), there's nothing to
  // release — we never acquired it. Everything past this point is wrapped
  // so any failure releases the lock; success leaves it held on purpose,
  // since commit()/abort() are separate later invocations that release it.
  acquireLock();
  try {
    if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      fail(`"${sourceDir}" isn't a folder.`);
    }

    ensureCleanRepo();
    pullLatest();

    const { jsonFile, imageFiles } = readSourceFolder(sourceDir);
    const projectData = readProjectJson(sourceDir, jsonFile);
    const { coverFile, rest } = organizeImages(imageFiles);

    const { jsonSlug, imageFolderLocation, isReplace, existingRanking } = resolveTarget(
      projectData.title,
      projectData.issueNumber,
      projectData.category
    );
    const ranking = projectData.ranking ?? existingRanking ?? nextRanking(projectData.category);

    const finalData = portfolioSchema.parse({
      ...projectData,
      ranking,
      imageFolderLocation,
    });

    const destImagesDir = path.join(REPO_ROOT, "public", imageFolderLocation);
    const destJsonPath = path.join(PORTFOLIO_CONTENT_DIR, `${jsonSlug}.json`);

    try {
      // Clear first (harmless no-op for a new project) so a replace with
      // fewer images than before doesn't leave old ones stranded.
      fs.rmSync(destImagesDir, { recursive: true, force: true });
      fs.mkdirSync(destImagesDir, { recursive: true });
      await processImage(path.join(sourceDir, coverFile), path.join(destImagesDir, "cover.jpg"));
      for (let i = 0; i < rest.length; i++) {
        const num = String(i + 1).padStart(2, "0");
        await processImage(path.join(sourceDir, rest[i]), path.join(destImagesDir, `${num}.jpg`));
      }
      fs.writeFileSync(destJsonPath, JSON.stringify(finalData, null, 2) + "\n");

      runBuildCheck();

      run("git", ["add", "--", relFromRoot(destImagesDir), relFromRoot(destJsonPath)]);
    } catch (err) {
      cleanupSlug(jsonSlug, imageFolderLocation);
      throw err;
    }

    printSummary(finalData, jsonSlug, rest.length, isReplace);
  } catch (err) {
    releaseLock();
    throw err;
  }
}

function printSummary(
  finalData: ReturnType<typeof portfolioSchema.parse>,
  slug: string,
  extraImageCount: number,
  isReplace: boolean
) {
  const catLabel = CATEGORIES.find((c) => c.slug === finalData.category)?.label ?? finalData.category;
  const displayTitle = finalData.issueNumber ? `${finalData.title} #${finalData.issueNumber}` : finalData.title;

  const lines: string[] = [];
  if (isReplace) {
    lines.push(
      `This will REPLACE the existing project "${displayTitle}" — all of its current images will be replaced by the ${extraImageCount + 1} you're submitting now.`,
      ""
    );
  }
  lines.push(
    `Title: ${displayTitle}`,
    `Category: ${catLabel}`,
    `Role: ${finalData.role}`,
    `Date: ${finalData.date}`,
    `Images: ${extraImageCount + 1} (including cover)`,
    `Ranking: ${finalData.ranking}`,
    "",
    isReplace ? "Publish this update?" : "Publish this to the live site?"
  );

  console.log(`SLUG:${slug}`);
  console.log(lines.join("\n"));
}

function loadStagedImageFolderLocation(jsonSlug: string): { destJsonPath: string; imageFolderLocation: string; title: string } {
  const destJsonPath = path.join(PORTFOLIO_CONTENT_DIR, `${jsonSlug}.json`);
  if (!fs.existsSync(destJsonPath)) {
    fail(`Nothing staged for "${jsonSlug}" — run prepare again.`);
  }
  const data = JSON.parse(fs.readFileSync(destJsonPath, "utf-8"));
  return { destJsonPath, imageFolderLocation: data.imageFolderLocation, title: data.title };
}

function commit(jsonSlug: string, opts: { dryRun: boolean }) {
  try {
    const { destJsonPath, title } = loadStagedImageFolderLocation(jsonSlug);

    const staged = git(["diff", "--cached", "--name-only"]);
    if (!staged.includes(jsonSlug)) {
      fail(`The staged changes don't match "${jsonSlug}" anymore — please start over.`);
    }

    // Was this project already committed before (an update) or is it brand
    // new? git's own index already knows — "M" (modified) vs "A" (added) —
    // no need to thread that state through from prepare() separately.
    const statusLine = git(["diff", "--cached", "--name-status", "--", relFromRoot(destJsonPath)]);
    const isReplace = statusLine.startsWith("M");

    run("git", ["commit", "-m", `${isReplace ? "Update" : "Add"} project: ${title}`]);

    if (opts.dryRun) {
      console.log("DRY RUN — commit made locally, skipping git push.");
      return;
    }

    try {
      run("git", ["push", "origin", "main"]);
    } catch (err) {
      const stderr = (err as any).stderr ? (err as any).stderr.toString().trim() : String(err);
      fail(`The project was saved locally but couldn't be pushed to GitHub. Please contact your site manager.\n${stderr}`);
    }

    console.log(`${isReplace ? "Updated" : "Published"} "${title}". The live site will update in a minute or two.`);
  } finally {
    releaseLock();
  }
}

function abort(jsonSlug: string) {
  try {
    const { imageFolderLocation } = loadStagedImageFolderLocation(jsonSlug);
    cleanupSlug(jsonSlug, imageFolderLocation);
    console.log("Cancelled — nothing was changed.");
  } finally {
    releaseLock();
  }
}

async function main() {
  const [, , cmd, arg] = process.argv;
  const dryRun = process.argv.includes("--dry-run");

  switch (cmd) {
    case "prepare":
      if (!arg) fail("Usage: prepare <sourceFolder>");
      await prepare(arg);
      break;
    case "commit":
      if (!arg) fail("Usage: commit <slug>");
      commit(arg, { dryRun });
      break;
    case "abort":
      if (!arg) fail("Usage: abort <slug>");
      abort(arg);
      break;
    default:
      fail(`Unknown command "${cmd}". Use prepare, commit, or abort.`);
  }
}

main().catch((err) => {
  if (err instanceof AddProjectError) {
    console.error(err.message);
  } else {
    console.error(`Unexpected error: ${err.stack ?? err.message ?? err}`);
  }
  process.exit(1);
});
