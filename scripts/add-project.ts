#!/usr/bin/env node
// Entry point for the "add a portfolio project" tool. Deliberately has zero
// dependencies beyond Node's built-ins, so it can check for (and install)
// everything else *before* loading any code that needs them — see
// add-project-core.ts, which does the real work and does depend on sharp/zod.
//
// This is what scripts/AddProject.applescript and `npm run add-project` call.

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();

function ensureDependencies() {
  const lockPath = path.join(REPO_ROOT, "package-lock.json");
  if (!fs.existsSync(lockPath)) return;

  const nodeModulesPath = path.join(REPO_ROOT, "node_modules");
  const marker = path.join(nodeModulesPath, ".add-project-lock-hash");

  const lockHash = crypto.createHash("sha1").update(fs.readFileSync(lockPath)).digest("hex");
  const markerHash = fs.existsSync(marker) ? fs.readFileSync(marker, "utf-8").trim() : null;

  if (fs.existsSync(nodeModulesPath) && lockHash === markerHash) return;

  console.log("Installing required components — this may take a minute...");
  try {
    execFileSync("npm", ["install"], { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    const stderr = (err as any).stderr ? (err as any).stderr.toString().trim() : String(err);
    console.error(`Couldn't install required components:\n${stderr}`);
    process.exit(1);
  }
  fs.writeFileSync(marker, lockHash);
}

ensureDependencies();

await import("./add-project-core.ts");
