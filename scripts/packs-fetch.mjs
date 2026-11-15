#!/usr/bin/env node
/**
 * Puts the community content packs into content-packs/community/<id>/, from the Mod Store registry repo
 * (quincarter/marvel-champions-mods, its packs/<id>/ folders) at the commit content-packs/community.json pins. The
 * packs are published from there; this repo keeps no copy in git, only uses them as test fixtures (the mod SDK's
 * per-pack tests, the client's pack and house-rule tests, the Mod Store e2e specs' local catalog).
 *
 * Usage: pnpm packs:fetch [--from <registry checkout>] [--force]
 *   --from <dir>   copy from a local checkout of the registry instead of fetching the pinned commit (every time)
 *   --force        fetch again even when the pinned commit is already in place
 *
 * Environment: MC_ASSETS_CACHE (the shared cache folder, as pnpm assets:fetch uses), MC_PACKS=none (skip).
 * The registry is fetched into <cache>/registry.git once, then only the pinned commit. A pack folder this script put
 * there earlier but the pinned commit no longer has is removed; folders it didn't put there are left alone.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cacheDir } from "./lib/assets.mjs";

const root = path.resolve(import.meta.dirname, "..");
const PIN = path.join(root, "content-packs", "community.json");
// MC_PACKS_DEST moves the destination (scripts/packs-fetch.test.mjs).
const DEST = process.env.MC_PACKS_DEST
  ? path.resolve(process.env.MC_PACKS_DEST)
  : path.join(root, "content-packs", "community");
const STATE = path.join(DEST, ".fetched.json");

const args = process.argv.slice(2);
const force = args.includes("--force");
const fromAt = args.indexOf("--from");
const from = fromAt >= 0 ? path.resolve(args[fromAt + 1] ?? "") : undefined;

if (process.env.MC_PACKS === "none") {
  console.log("[packs] nothing to fetch (MC_PACKS=none)");
  process.exit(0);
}

const pin = JSON.parse(fs.readFileSync(PIN, "utf8"));
if (!/^[0-9a-f]{40}$/.test(pin.commit ?? "")) throw new Error(`${PIN}: commit must be a full sha`);
const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return { ids: [] };
  }
};
const state = readState();
const source = from ? `local:${from}` : pin.commit;
// A pinned commit never changes, so it is fetched once; a local checkout can, so --from always copies.
if (
  !force &&
  !from &&
  state.source === source &&
  state.ids.every((id) => fs.existsSync(path.join(DEST, id, "pack.json")))
) {
  console.log(`[packs] ${state.ids.length} packs already at ${source.slice(0, 12)}`);
  process.exit(0);
}

const git = (cwd, ...gitArgs) => execFileSync("git", gitArgs, { cwd, stdio: ["ignore", "pipe", "inherit"] });

/** The registry's packs/ folder at the pinned commit (or the local checkout's), as a path. */
function packsFolder() {
  if (from) return path.join(from, "packs");
  const bare = path.join(cacheDir(), "registry.git");
  if (!fs.existsSync(bare)) {
    fs.mkdirSync(bare, { recursive: true });
    git(bare, "init", "--bare", "--quiet");
  }
  // Fetch the commit unless the cache has it already (a commit, unlike a branch, never changes).
  try {
    execFileSync("git", ["cat-file", "-e", `${pin.commit}^{commit}`], { cwd: bare, stdio: "ignore" });
  } catch {
    console.log(`[packs] fetching ${pin.repo} at ${pin.commit.slice(0, 12)}`);
    git(bare, "fetch", "--quiet", "--depth", "1", pin.repo, pin.commit);
  }
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), "mc-packs-"));
  git(bare, `--work-tree=${tree}`, "checkout", "--quiet", pin.commit, "--", "packs");
  return path.join(tree, "packs");
}

const packs = packsFolder();
const ids = fs
  .readdirSync(packs, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(packs, entry.name, "pack.json")))
  .map((entry) => entry.name)
  .sort();
fs.mkdirSync(DEST, { recursive: true });
for (const id of state.ids) {
  if (!ids.includes(id)) fs.rmSync(path.join(DEST, id), { recursive: true, force: true });
}
for (const id of ids) {
  fs.rmSync(path.join(DEST, id), { recursive: true, force: true });
  fs.cpSync(path.join(packs, id), path.join(DEST, id), { recursive: true });
}
if (!from) fs.rmSync(path.dirname(packs), { recursive: true, force: true });
fs.writeFileSync(STATE, `${JSON.stringify({ source, ids }, null, 2)}\n`);
console.log(`[packs] ${ids.length} packs from ${source.slice(0, 12)} → content-packs/community: ${ids.join(", ")}`);
