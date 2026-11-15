#!/usr/bin/env node
/**
 * Puts the community content packs into content-packs/community/<id>/, from the Mod Store registry repo
 * (quincarter/marvel-champions-mods, its packs/<id>/ folders) at the commit content-packs/community.json pins. The
 * packs are published from there; this repo keeps no copy in git, only uses them as test fixtures (the mod SDK's
 * per-pack tests, the client's pack and house-rule tests, the Mod Store e2e specs' local catalog).
 *
 * Usage: pnpm packs:fetch [--from <registry checkout>] [--force]
 *   --from <dir>   copy from a local checkout of the registry instead of fetching the pinned commit (every time)
 *   --force        fetch again even when the pinned commit is already in place, and replace pack folders this script
 *                  didn't put there (without it, such a folder stops the run before anything changes)
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
  state.complete === true &&
  state.ids.every((id) => fs.existsSync(path.join(DEST, id, "pack.json")))
) {
  console.log(`[packs] ${state.ids.length} packs already at ${source.slice(0, 12)}`);
  process.exit(0);
}

const git = (cwd, gitArgs, env = process.env) =>
  execFileSync("git", gitArgs, { cwd, env, stdio: ["ignore", "pipe", "inherit"] });

/** Runs `step`, retrying a few times: another worktree's fetch may hold the shared cache's lock for a moment. */
function withRetry(step) {
  for (let attempt = 1; ; attempt++) {
    try {
      return step();
    } catch (error) {
      if (attempt >= 4) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000 * attempt);
    }
  }
}

/** The registry's packs/ folder at the pinned commit (or the local checkout's), as a path. */
function packsFolder() {
  if (from) return path.join(from, "packs");
  const bare = path.join(cacheDir(), "registry.git");
  if (!fs.existsSync(bare)) {
    fs.mkdirSync(bare, { recursive: true });
    git(bare, ["init", "--bare", "--quiet"]);
  }
  // Fetch the commit unless the cache has it already (a commit, unlike a branch, never changes).
  try {
    execFileSync("git", ["cat-file", "-e", `${pin.commit}^{commit}`], { cwd: bare, stdio: "ignore" });
  } catch {
    console.log(`[packs] fetching ${pin.repo} at ${pin.commit.slice(0, 12)}`);
    withRetry(() => git(bare, ["fetch", "--quiet", "--depth", "1", pin.repo, pin.commit]));
  }
  // Every checkout shares the cache, so each extraction gets its own index file: two worktrees fetching at once never
  // contend for the bare repo's index.lock.
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), "mc-packs-"));
  const index = { ...process.env, GIT_INDEX_FILE: path.join(tree, ".git-index") };
  git(bare, [`--work-tree=${tree}`, "checkout", "--quiet", pin.commit, "--", "packs"], index);
  return path.join(tree, "packs");
}

const packs = packsFolder();
const ids = fs
  .readdirSync(packs, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(packs, entry.name, "pack.json")))
  .map((entry) => entry.name)
  .sort();
// A folder this script didn't put there (an older checkout's copy of a pack, or one being worked on) is never replaced
// without --force: the folder is gitignored, so anything lost there is hard to get back.
const unowned = ids.filter((id) => !state.ids.includes(id) && fs.existsSync(path.join(DEST, id)));
if (unowned.length > 0 && !force) {
  if (!from) fs.rmSync(path.dirname(packs), { recursive: true, force: true });
  console.error(
    `[packs] content-packs/community/ already has ${unowned.join(", ")}, not put there by pnpm packs:fetch. ` +
      "Move them aside (or delete them) and run it again, or pass --force to replace them.",
  );
  process.exit(1);
}
fs.mkdirSync(DEST, { recursive: true });
// Marked incomplete before anything changes (keeping every id it owns, old and new, for a retry), and complete only once
// every pack is in place: an interrupted run is redone by the next one, never taken as done.
const writeState = (complete, owned) => {
  const tmp = `${STATE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ source, ids: owned, complete }, null, 2)}\n`);
  fs.renameSync(tmp, STATE);
};
writeState(false, [...new Set([...state.ids, ...ids])].sort());
for (const id of state.ids) {
  if (!ids.includes(id)) fs.rmSync(path.join(DEST, id), { recursive: true, force: true });
}
for (const id of ids) {
  fs.rmSync(path.join(DEST, id), { recursive: true, force: true });
  fs.cpSync(path.join(packs, id), path.join(DEST, id), { recursive: true });
}
if (!from) fs.rmSync(path.dirname(packs), { recursive: true, force: true });
writeState(true, ids);
console.log(`[packs] ${ids.length} packs from ${source.slice(0, 12)} → content-packs/community: ${ids.join(", ")}`);
