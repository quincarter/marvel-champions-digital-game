import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unzipSync } from "fflate";
import type { PackPreview } from "@mc/content";
import { assemblePack, buildPack, loadPackSource } from "./build.js";
import { TINY_PACK_DIR, fakeWebp } from "./fixtures/load.js";
import { buildPreview } from "./preview.js";

const dirs: string[] = [];
const tmp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "mc-pack-"));
  dirs.push(dir);
  return dir;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

async function withPictures() {
  const source = await loadPackSource(TINY_PACK_DIR);
  const assets = new Map(source.assets);
  for (const code of ["x.tiny-pack.01a", "x.tiny-pack.01b", "x.tiny-pack.02"])
    assets.set(`cards/en/${code}.webp`, bytes(`pic ${code}`));
  const author = { ...source.author, languages: { base: "en", available: ["en"] } };
  return assemblePack({ ...source, author, assets });
}

describe("buildPreview", () => {
  it("features a hero pack's identity with both faces' pictures, and lists the cards and decks", async () => {
    const { preview, thumbFrom } = buildPreview(await withPictures());
    expect(preview.schema).toBe(1);
    expect(preview.featured).toEqual({
      cardId: "x.tiny-pack.01a",
      images: ["cards/en/x.tiny-pack.01a.webp", "cards/en/x.tiny-pack.01b.webp"],
    });
    expect(thumbFrom).toBe("cards/en/x.tiny-pack.01a.webp");
    expect(preview.images).toEqual([
      "cards/en/x.tiny-pack.01a.webp",
      "cards/en/x.tiny-pack.01b.webp",
      "cards/en/x.tiny-pack.02.webp",
    ]);
    expect((preview.cards as { id: string }[]).map((card) => card.id)).toEqual(["x.tiny-pack.01a", "x.tiny-pack.02"]);
    expect(preview.decks).toHaveLength(1);
    expect(preview.decks[0]!.cards.every((entry) => entry.quantity > 0)).toBe(true);
  });

  it("features the card with no picture, and no thumbnail, when the pack ships none", async () => {
    const { preview, thumbFrom } = buildPreview(assemblePack(await loadPackSource(TINY_PACK_DIR)));
    expect(preview.featured).toEqual({ cardId: "x.tiny-pack.01a", images: [] });
    expect(preview.images).toEqual([]);
    expect(thumbFrom).toBeUndefined();
  });

  it("is the same bytes twice", async () => {
    const a = JSON.stringify(buildPreview(await withPictures()).preview);
    const b = JSON.stringify(buildPreview(await withPictures()).preview);
    expect(a).toBe(b);
  });
});

describe("buildPack's preview files", () => {
  it("writes preview.json beside the zip, not in it, and leaves the zip unchanged", async () => {
    const out = tmp();
    const result = await buildPack(TINY_PACK_DIR, out);
    const preview = JSON.parse(readFileSync(join(out, "preview.json"), "utf8")) as PackPreview;
    expect(preview.packId).toBe("tiny-pack");
    expect(existsSync(join(out, "thumb.webp"))).toBe(false);
    const entries = unzipSync(new Uint8Array(readFileSync(result.zipPath)));
    expect(Object.keys(entries)).not.toContain("preview.json");
    const again = await buildPack(TINY_PACK_DIR, tmp());
    expect(again.zipSha256).toBe(result.zipSha256);
  });

  it("makes the pack's cover the thumbnail, not the featured picture, and ships it in the zip", async () => {
    const src = join(tmp(), "tiny-pack");
    cpSync(TINY_PACK_DIR, src, { recursive: true });
    const cover = fakeWebp(600, 984);
    writeFileSync(join(src, "cover.webp"), cover);
    mkdirSync(join(src, "cards", "en"), { recursive: true });
    writeFileSync(join(src, "cards", "en", "x.tiny-pack.01a.webp"), bytes("pic 01a"));
    const manifest = JSON.parse(readFileSync(join(src, "pack.json"), "utf8")) as Record<string, unknown>;
    manifest.cover = "cover.webp";
    manifest.languages = { base: "en", available: ["en"] };
    writeFileSync(join(src, "pack.json"), JSON.stringify(manifest));
    const out = tmp();
    // The copy's abilities import the SDK by a relative path, so they load from the fixture's own folder.
    const fixtureAbilities = pathToFileURL(join(TINY_PACK_DIR, "abilities", "index.ts")).href;
    const result = await buildPack(src, out, { importModule: () => import(/* @vite-ignore */ fixtureAbilities) });
    expect(result.manifest.cover).toBe("cover.webp");
    expect(new Uint8Array(readFileSync(join(out, "thumb.webp")))).toEqual(cover);
    const preview = JSON.parse(readFileSync(join(out, "preview.json"), "utf8")) as PackPreview;
    expect(preview.cover).toBe("cover.webp");
    // The featured card still leads the pack page with its own picture.
    expect(preview.featured?.images).toEqual(["cards/en/x.tiny-pack.01a.webp"]);
    const entries = unzipSync(new Uint8Array(readFileSync(result.zipPath)));
    expect(entries["cover.webp"]).toEqual(cover);
    expect(existsSync(join(out, "cover.webp"))).toBe(true);
  });
});
