#!/usr/bin/env node
/**
 * Prints the Mod Store's new index.json (docs/custom-content-packs.md §11.5) for the publish-packs workflow: the
 * current catalog with the packs staged in this run upserted (scripts/lib/pack-index.mjs has the rules).
 *
 * Usage: node scripts/publish-pack-index.mjs <staging dir> <base url> [current index.json]
 *   <staging dir>  <id>/<version>/{<id>-<version>.zip,pack.json,preview.json,thumb.webp}, as uploaded to R2
 *   <base url>     where the bucket is served, e.g. https://packs.example.app
 *   current        the index.json now on R2; leave it out (or name a missing file) when there is none yet
 */
import fs from "node:fs/promises";
import { readStagedPacks, upsertPackIndex } from "./lib/pack-index.mjs";

const [staging, baseUrl, currentPath] = process.argv.slice(2);
if (!staging || !baseUrl || !/^https?:\/\//.test(baseUrl)) {
  console.error("Usage: node scripts/publish-pack-index.mjs <staging dir> <base url> [current index.json]");
  process.exit(2);
}
let current;
if (currentPath) {
  try {
    current = JSON.parse(await fs.readFile(currentPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const now = new Date().toISOString();
const built = await readStagedPacks(staging, baseUrl, now.slice(0, 10));
const index = upsertPackIndex(current, built, { today: now.slice(0, 10), now: now.replace(/\.\d+Z$/, "Z") });
process.stdout.write(`${JSON.stringify(index, null, 2)}\n`);
