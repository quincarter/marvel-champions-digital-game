import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import type { PackManifest } from "@mc/content";
import { buildPack, PackBuildError } from "./build.js";
import { TINY_PACK_DIR } from "./fixtures/load.js";
import { readPackInput, validatePack } from "./validate.js";

const dirs: string[] = [];
const tmp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "mc-pack-"));
  dirs.push(dir);
  return dir;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("buildPack", () => {
  it("builds the same zip bytes twice", async () => {
    const a = await buildPack(TINY_PACK_DIR, tmp());
    const b = await buildPack(TINY_PACK_DIR, tmp());
    expect(a.zipSha256).toBe(b.zipSha256);
    expect(readFileSync(a.zipPath).equals(readFileSync(b.zipPath))).toBe(true);
    expect(a.zipPath.endsWith("tiny-pack-1.0.0.zip")).toBe(true);
  });

  it("fills in the manifest", async () => {
    const { manifest } = await buildPack(TINY_PACK_DIR, tmp());
    expect(manifest.schema).toBe(1);
    expect(manifest.requires.dslFeatures).toContain("effect:thwart");
    const paths = manifest.files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
    expect(paths).toEqual(
      expect.arrayContaining([
        "data/cards.json",
        "data/abilities.json",
        "data/decks.json",
        "CREDITS.md",
        "PERMISSION.md",
      ]),
    );
    expect(manifest.totalBytes).toBe(manifest.files.reduce((sum, f) => sum + f.bytes, 0));
  });

  it("validates when read back from the zip", async () => {
    const result = await buildPack(TINY_PACK_DIR, tmp());
    const entries = unzipSync(new Uint8Array(readFileSync(result.zipPath)));
    const manifest = JSON.parse(new TextDecoder().decode(entries["pack.json"])) as PackManifest;
    const files = new Map(Object.entries(entries).filter(([path]) => path !== "pack.json"));
    expect(validatePack(readPackInput(manifest, files))).toEqual([]);
  });

  it("writes the same manifest to pack.json", async () => {
    const out = tmp();
    const { manifest } = await buildPack(TINY_PACK_DIR, out);
    expect(JSON.parse(readFileSync(join(out, "pack.json"), "utf8"))).toEqual(manifest);
  });

  it("refuses a pack that fails validation", async () => {
    await expect(buildPack(TINY_PACK_DIR, tmp(), { supportedFeatures: [] })).rejects.toBeInstanceOf(PackBuildError);
  });
});
