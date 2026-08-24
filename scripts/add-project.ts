#!/usr/bin/env node
// Adds a new portfolio project from a source folder (images + one JSON file).
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
const PORTFOLIO_IMAGES_DIR = path.join(REPO_ROOT, "public/images/portfolio");

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

function git(args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT }).toString().trim();
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
    execFileSync("git", ["pull", "--ff-only", "origin", "main"], { cwd: REPO_ROOT });
  } catch {
    fail("Couldn't update from GitHub (your copy may have diverged). Please contact your site manager.");
  }
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

  // Treat blank strings left over from the template as "not provided" —
  // Ryan is more likely to leave a placeholder blank than delete the key.
  for (const key of ["coCredit", "coCreditLink", "contentLink"]) {
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

function findExistingByTitle(title: string, issueNumber?: number): string | null {
  if (!fs.existsSync(PORTFOLIO_CONTENT_DIR)) return null;
  const files = fs
    .readdirSync(PORTFOLIO_CONTENT_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"));

  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PORTFOLIO_CONTENT_DIR, f), "utf-8"));
      const sameTitle = typeof data.title === "string" && data.title.trim().toLowerCase() === title.trim().toLowerCase();
      const sameIssue = (data.issueNumber ?? undefined) === (issueNumber ?? undefined);
      if (sameTitle && sameIssue) return f;
    } catch {
      // an existing file being unreadable isn't this run's problem
    }
  }
  return null;
}

function computeSlug(title: string, issueNumber?: number): string {
  const existing = findExistingByTitle(title, issueNumber);
  if (existing) {
    fail(
      `A project with that same title${issueNumber ? ` and issue number` : ""} already exists (${existing}). Use a different title (or issue number), or contact your site manager if you meant to update an existing one.`
    );
  }

  const slug = slugify(title, issueNumber);
  if (!slug) {
    fail("Couldn't build a name from the title — try a title with letters or numbers in it.");
  }
  const jsonPath = path.join(PORTFOLIO_CONTENT_DIR, `${slug}.json`);
  if (fs.existsSync(jsonPath)) {
    fail(
      `A project called "${slug}" already exists. Use a different title (or issue number), or contact your site manager if you meant to update an existing one.`
    );
  }
  return slug;
}

function organizeImages(imageFiles: string[]) {
  const coverFile = imageFiles.find((f) => path.parse(f).name.toLowerCase() === "cover");
  if (!coverFile) {
    fail('No cover image found. Name one image file "cover" (e.g. cover.jpg) — it\'ll be used as the main image.');
  }
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
    execFileSync("npm", ["run", "build"], { cwd: REPO_ROOT });
  } catch (err) {
    const output = ((err as any).stdout?.toString() ?? "") + ((err as any).stderr?.toString() ?? "");
    fail(`The site failed to build with this project's data — nothing was saved:\n${output.slice(-2000)}`);
  }
}

function cleanupSlug(slug: string) {
  const destImagesDir = path.join(PORTFOLIO_IMAGES_DIR, slug);
  const destJsonPath = path.join(PORTFOLIO_CONTENT_DIR, `${slug}.json`);
  try {
    execFileSync("git", ["restore", "--staged", "--", destImagesDir, destJsonPath], { cwd: REPO_ROOT });
  } catch {
    // may not have been staged yet — that's fine
  }
  fs.rmSync(destImagesDir, { recursive: true, force: true });
  fs.rmSync(destJsonPath, { force: true });
}

async function prepare(sourceDir: string) {
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    fail(`"${sourceDir}" isn't a folder.`);
  }

  ensureCleanRepo();
  pullLatest();

  const { jsonFile, imageFiles } = readSourceFolder(sourceDir);
  const projectData = readProjectJson(sourceDir, jsonFile);
  const { coverFile, rest } = organizeImages(imageFiles);

  const slug = computeSlug(projectData.title, projectData.issueNumber);
  const ranking = projectData.ranking ?? nextRanking(projectData.category);
  const imageFolderLocation = `images/portfolio/${slug}`;

  const finalData = portfolioSchema.parse({
    ...projectData,
    ranking,
    imageFolderLocation,
  });

  const destImagesDir = path.join(PORTFOLIO_IMAGES_DIR, slug);
  const destJsonPath = path.join(PORTFOLIO_CONTENT_DIR, `${slug}.json`);

  try {
    fs.mkdirSync(destImagesDir, { recursive: true });
    await processImage(path.join(sourceDir, coverFile), path.join(destImagesDir, "cover.jpg"));
    for (let i = 0; i < rest.length; i++) {
      const num = String(i + 1).padStart(2, "0");
      await processImage(path.join(sourceDir, rest[i]), path.join(destImagesDir, `${num}.jpg`));
    }
    fs.writeFileSync(destJsonPath, JSON.stringify(finalData, null, 2) + "\n");

    runBuildCheck();

    execFileSync("git", ["add", "--", relFromRoot(destImagesDir), relFromRoot(destJsonPath)], {
      cwd: REPO_ROOT,
    });
  } catch (err) {
    cleanupSlug(slug);
    throw err;
  }

  const catLabel = CATEGORIES.find((c) => c.slug === finalData.category)?.label ?? finalData.category;
  const displayTitle = finalData.issueNumber ? `${finalData.title} #${finalData.issueNumber}` : finalData.title;

  console.log(`SLUG:${slug}`);
  console.log(
    [
      `Title: ${displayTitle}`,
      `Category: ${catLabel}`,
      `Images: ${rest.length + 1} (including cover)`,
      `Ranking: ${ranking}`,
      "",
      "Publish this to the live site?",
    ].join("\n")
  );
}

function commit(slug: string, opts: { dryRun: boolean }) {
  const destImagesDir = path.join(PORTFOLIO_IMAGES_DIR, slug);
  const destJsonPath = path.join(PORTFOLIO_CONTENT_DIR, `${slug}.json`);
  if (!fs.existsSync(destJsonPath)) {
    fail(`Nothing staged for "${slug}" — run prepare again.`);
  }
  const staged = git(["diff", "--cached", "--name-only"]);
  if (!staged.includes(slug)) {
    fail(`The staged changes don't match "${slug}" anymore — please start over.`);
  }

  const data = JSON.parse(fs.readFileSync(destJsonPath, "utf-8"));
  execFileSync("git", ["commit", "-m", `Add project: ${data.title}`], { cwd: REPO_ROOT });

  if (opts.dryRun) {
    console.log("DRY RUN — commit made locally, skipping git push.");
    return;
  }

  try {
    execFileSync("git", ["push", "origin", "main"], { cwd: REPO_ROOT });
  } catch (err) {
    const stderr = (err as any).stderr ? (err as any).stderr.toString().trim() : String(err);
    fail(`The project was saved locally but couldn't be pushed to GitHub. Please contact your site manager.\n${stderr}`);
  }

  console.log(`Published "${data.title}". The live site will update in a minute or two.`);
}

function abort(slug: string) {
  cleanupSlug(slug);
  console.log("Cancelled — nothing was changed.");
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
