#!/usr/bin/env node
/**
 * The incoming/ folder: how media gets into the bundles from a pull request (issue #495). A contributor puts new or
 * changed files under incoming/ at the path they belong at (incoming/assets/card-art/bundles/cards/63001a.png,
 * incoming/music/scenarios/rhino/battle.mp3); reviewers see them in the diff, and `pnpm assets:fetch` and every CI
 * build lay them over the fetched bundles, so the preview shows them. After the merge, .github/workflows/
 * media-incoming.yml runs `--pack`, which uploads the bundles they join and opens a pull request with the new
 * manifest and an emptied incoming/ (its .gitkeep stays).
 *
 * Usage: node scripts/assets-incoming.mjs [--check | --place | --pack]
 *   --check  (default) list where each file goes; exit 1 if one has nowhere to go
 *   --place  copy them into place over what assets:fetch installed
 *   --pack   fetch the bundles they join, place them, pack and upload those bundles, then delete them from incoming/
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  INCOMING_DIR,
  listFiles,
  mapIncoming,
  placeIncoming,
  readManifest,
  readState,
  writeState,
} from "./lib/assets.mjs";
import { run } from "./lib/run.mjs";

const root = path.resolve(import.meta.dirname, "..");
const mode = process.argv.includes("--pack") ? "pack" : process.argv.includes("--place") ? "place" : "check";

const manifest = await readManifest(root);
const { files, errors } = mapIncoming(manifest, await listFiles(path.join(root, INCOMING_DIR)));
for (const { rel, bundle } of files) console.log(`[incoming] ${rel} → ${bundle.name}`);
if (errors.length > 0) {
  console.error(errors.map((e) => `[incoming] ${e}`).join("\n"));
  process.exit(1);
}
if (files.length === 0) {
  console.log("[incoming] nothing in incoming/");
  process.exit(0);
}
if (mode === "check") process.exit(0);

const bundles = [...new Set(files.map((f) => f.bundle.name))];
if (mode === "pack") node("scripts/assets-fetch.mjs", bundles);
await placeIncoming(root, files);
console.log(`[incoming] placed ${files.length} file(s)`);
if (mode === "place") process.exit(0);

node("scripts/assets-pack.mjs", [...bundles, "--with-incoming"]);
for (const { rel } of files) await fs.rm(path.join(root, INCOMING_DIR, ...rel.split("/")));
// They are the bundles' own files now, not an overlay for the next fetch to take away.
const state = await readState(root);
for (const { rel } of files) delete state.incoming?.[rel];
await writeState(root, state);
await removeEmptyFolders(path.join(root, INCOMING_DIR), true);
console.log(`[incoming] packed ${bundles.join(", ")} and emptied incoming/`);

function node(script, args) {
  const result = run(process.execPath, [script, ...args], { cwd: root });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function removeEmptyFolders(dir, keep) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await removeEmptyFolders(path.join(dir, entry.name), false);
  }
  if (!keep && (await fs.readdir(dir)).length === 0) await fs.rmdir(dir);
}
