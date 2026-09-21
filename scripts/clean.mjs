#!/usr/bin/env node
// Remove every package's build output. `rm -rf packages/*/dist` in package.json only worked where a POSIX shell
// runs the scripts; on Windows pnpm hands them to cmd.exe, which has no rm.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(repoRoot, "packages");

for (const name of fs.readdirSync(packagesDir)) {
  const dist = path.join(packagesDir, name, "dist");
  if (!fs.existsSync(dist)) continue;
  fs.rmSync(dist, { recursive: true, force: true });
  console.log(`[clean] removed packages/${name}/dist`);
}

for (const dirName of ["release", "dist"]) {
  const dirPath = path.join(repoRoot, dirName);
  if (!fs.existsSync(dirPath)) continue;
  fs.rmSync(dirPath, { recursive: true, force: true });
  console.log(`[clean] removed ${dirName}/`);
}
