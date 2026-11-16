/**
 * The Mod Store fields of `pack.json` (issue #734) from a pack's source to the running game: `mc-pack build` keeps
 * `tags`, `wave` and `unlock`, and `loadPackRuntime` hands the wave and the unlock mode to the shelves and the unlock
 * path. Also keeps the waves a pack may name in step with the game's own.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { PACK_WAVE_IDS, type PackManifest } from "@mc/content";
import { buildPack } from "@mc/mod-sdk/build";
import { UNLOCK_WAVES } from "../progression/unlocks.js";
import { loadPackRuntime } from "./pack-load.js";

const PACKS = fileURLToPath(new URL("../../../../content-packs", import.meta.url));
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

/** The sample hero pack built with `extra` merged into its source `pack.json`, then loaded as an installed pack is. */
async function builtWith(extra: Record<string, unknown>) {
  const src = mkdtempSync(join(tmpdir(), "mc-store-fields-src-"));
  const out = mkdtempSync(join(tmpdir(), "mc-store-fields-out-"));
  dirs.push(src, out);
  cpSync(join(PACKS, "sample-hero"), src, { recursive: true });
  const file = join(src, "pack.json");
  const source = { ...(JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>), ...extra };
  if (typeof source.cover === "string" && !existsSync(join(src, ...source.cover.split("/")))) delete source.cover;
  writeFileSync(file, JSON.stringify(source));
  await buildPack(src, out);
  const manifest = JSON.parse(readFileSync(join(out, "pack.json"), "utf8")) as PackManifest;
  const files = new Map<string, Uint8Array>();
  for (const full of walk(out)) {
    const path = relative(out, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
  return { manifest, result: loadPackRuntime(manifest, files) };
}

describe("pack.json's Mod Store fields (issue #734)", () => {
  it("survive the build and reach the loaded pack", async () => {
    const { manifest, result } = await builtWith({ tags: ["Sample"], wave: "cycle3", unlock: "points" });
    expect(manifest.tags).toEqual(["Sample"]);
    if (!result.ok) throw new Error(result.reason);
    expect(result.runtime.wave).toBe("cycle3");
    expect(result.runtime.unlock).toBe("points");
  }, 60_000);

  it("leave a pack without them open and unplaced", async () => {
    const { result } = await builtWith({});
    if (!result.ok) throw new Error(result.reason);
    expect(result.runtime.wave).toBeUndefined();
    expect(result.runtime.unlock).toBeUndefined();
  }, 60_000);

  it("name only the waves the game's unlock path knows, and every one of them", () => {
    expect([...PACK_WAVE_IDS].sort()).toEqual(UNLOCK_WAVES.map((wave) => wave.cycleId).sort());
  });
});
