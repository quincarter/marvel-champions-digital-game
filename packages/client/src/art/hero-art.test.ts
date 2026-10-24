import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import * as content from "@mc/content";
import { artFor, artPathOf } from "./art-source.js";
import { HERO_ART, heroArtFor, heroArtForIdentity, parseFocus, parseHeroArt } from "./hero-art.js";
import { coverFit, focusedOffset } from "./pictures.js";

describe("parseHeroArt", () => {
  test("the folder's id prefix is the lookup; the slug is ignored; variants collect", () => {
    const catalog = parseHeroArt({
      "../art/heroes/01001a-spider-man/hero.jpg": "/a",
      "../art/heroes/01001a-spider-man/hero-2.png": "/b",
      "../art/heroes/51001a-black-panther-shuri/hero.webp": "/c",
    });
    expect(catalog.heroes.get("01001a")?.map((p) => p.url)).toEqual(["/b", "/a"]);
    expect(heroArtFor(catalog, "51001a", () => 0)?.url).toBe("/c");
    expect(heroArtFor(catalog, "99999a")).toBeNull();
  });

  test("a misnamed file is reported, and a _holding folder is never read", () => {
    const catalog = parseHeroArt({
      "../art/heroes/01001a-spider-man/spidey.jpg": "/a",
      "../art/heroes/_pending/phoenix.jpeg": "/b",
    });
    expect(catalog.unrecognized).toEqual(["heroes/01001a-spider-man/spidey.jpg"]);
    expect(catalog.heroes.size).toBe(0);
  });
});

describe("a hero's focus.json", () => {
  test("rides on every picture in its folder, by identity id; other heroes have none", () => {
    const catalog = parseHeroArt(
      {
        "../art/heroes/60001a-daredevil/hero.jpg": "/a",
        "../art/heroes/60001a-daredevil/hero-2.jpg": "/b",
        "../art/heroes/60037a-echo/hero.jpg": "/c",
      },
      { "../art/heroes/60001a-daredevil/focus.json": { x: 0.38, y: 0.3 } },
    );
    expect(heroArtFor(catalog, "60001a", () => 0)?.focus).toEqual({ x: 0.38, y: 0.3 });
    expect(catalog.heroes.get("60001a")?.every((picture) => picture.focus?.x === 0.38)).toBe(true);
    expect(heroArtFor(catalog, "60037a")?.focus).toBeUndefined();
    expect(catalog.unrecognized).toEqual([]);
  });

  test("an axis may be left out, values clamp to 0..1, and junk is ignored", () => {
    expect(parseFocus({ x: 0.4 })).toEqual({ x: 0.4 });
    expect(parseFocus({ y: 2, x: -1 })).toEqual({ x: 0, y: 1 });
    expect(parseFocus({ x: "left" })).toBeNull();
    expect(parseFocus(null)).toBeNull();
  });

  test("a focus in _pending is never read", () => {
    const catalog = parseHeroArt(
      { "../art/heroes/01001a-spider-man/hero.jpg": "/a" },
      {
        "../art/heroes/_pending/40037a-domino/focus.json": { x: 0.1 },
      },
    );
    expect(heroArtFor(catalog, "01001a")?.focus).toBeUndefined();
  });

  test("a cover crop centers on the focus, clamped inside the picture", () => {
    // Daredevil's 700x500 in a 200x400 box: the crop is 250 wide.
    const fit = coverFit({ width: 700, height: 500 }, { width: 200, height: 400 }, { x: 0.38 });
    expect(fit.cropX).toBeCloseTo(0.38 * 700 - 125);
    expect(coverFit({ width: 700, height: 500 }, { width: 200, height: 400 }).cropX).toBeCloseTo(225);
    expect(focusedOffset(700, 250, 0)).toBe(0);
    expect(focusedOffset(700, 250, 1)).toBe(450);
    expect(focusedOffset(500, 500, 0.2)).toBe(0);
  });
});

describe("the real art/heroes folder", () => {
  const identityIds = new Set<string>();
  for (const [name, value] of Object.entries(content)) {
    if (!name.endsWith("_CARDS") || !Array.isArray(value)) continue;
    for (const card of value as { id: string; type: string }[])
      if (card.type === "hero_identity") identityIds.add(card.id);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/heroes");
  const folders = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name);

  test("has pictures, and every file fits the slot", () => {
    expect(HERO_ART.heroes.size).toBeGreaterThan(0);
    expect(HERO_ART.unrecognized).toEqual([]);
  });

  test("every focus.json is valid and sits in a folder with a picture", () => {
    for (const name of folders) {
      const file = join(root, name, "focus.json");
      if (!existsSync(file)) continue;
      expect(parseFocus(JSON.parse(readFileSync(file, "utf8"))), name).not.toBeNull();
      expect(HERO_ART.heroes.get(name.split("-")[0]!), name).toBeDefined();
    }
    expect(HERO_ART.heroes.get("60001a")?.[0]?.focus).toEqual({ x: 0.38, y: 0.3 });
  });

  test("every folder (empty ones included) is named for a real hero identity card id", () => {
    expect(folders.filter((name) => !identityIds.has(name.split("-")[0]!))).toEqual([]);
  });
});

/**
 * Hero tiles on Take your seats (owner report, Steam Deck AppImage: Thor's tile and others blank). Linux and Netlify are
 * case-sensitive and Windows is not, so every path a tile can ask for is checked here against the directory listing
 * itself, letter for letter, and every picture is checked to be what its extension says it is and to be whole.
 */
describe("hero tile art is found and intact on a case-sensitive disk", () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const heroRoot = join(repoRoot, "art/heroes");
  const scanRoot = join(repoRoot, "assets/card-art");
  const folders = readdirSync(heroRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  /** Whether `relative` exists under `root` with every segment spelled exactly as the listing spells it. */
  const existsExactly = (root: string, relative: string): boolean => {
    let dir = root;
    for (const segment of relative.split("/")) {
      if (!readdirSync(dir).includes(segment)) return false;
      dir = join(dir, segment);
    }
    return true;
  };

  const identities: { id: string; name: string; type: string; setCode?: string }[] = [];
  for (const [name, value] of Object.entries(content)) {
    if (!name.endsWith("_CARDS") || !Array.isArray(value)) continue;
    for (const card of value as { id: string; type: string; name: string; setCode?: string }[])
      if (card.type === "hero_identity") identities.push(card);
  }

  test("every picture's folder and file are spelled exactly as the listing spells them, in lower case", () => {
    const wrong: string[] = [];
    for (const [id, pictures] of HERO_ART.heroes) {
      for (const picture of pictures) {
        const relative = picture.key.replace(/^scene-art:/, "");
        if (!existsExactly(join(repoRoot, "art"), relative)) wrong.push(`${id}: ${relative}`);
        if (relative !== relative.toLowerCase()) wrong.push(`${id}: ${relative} is not all lower case`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test("every hero identity's printed-scan fallback is on disk under exactly the path the tile asks for", () => {
    const wrong: string[] = [];
    for (const card of identities) {
      const scan = artFor(card as never, { kind: "hero" });
      if (!scan) continue;
      const relative = artPathOf(scan);
      if (!existsExactly(scanRoot, relative)) wrong.push(`${card.id}: ${relative}`);
    }
    expect(wrong).toEqual([]);
  });

  test("every hero identity draws a picture: its own art, or its scan behind it", () => {
    const blank = identities.filter(
      (card) =>
        heroArtForIdentity(HERO_ART, card.id, identities, () => 0) === null && !artFor(card as never, { kind: "hero" }),
    );
    expect(blank.map((card) => card.id)).toEqual([]);
  });

  test("every picture is the format its extension names, and is whole", () => {
    const bad: string[] = [];
    for (const folder of folders) {
      for (const file of readdirSync(join(heroRoot, folder))) {
        const extension = file.slice(file.lastIndexOf(".") + 1);
        if (!["png", "jpg", "jpeg", "webp", "avif"].includes(extension)) continue;
        const bytes = readFileSync(join(heroRoot, folder, file));
        const where = `${folder}/${file}`;
        if (extension !== extension.toLowerCase()) bad.push(`${where}: extension not lower case`);
        if (extension === "png") {
          const png = [0x89, 0x50, 0x4e, 0x47].every((byte, i) => bytes[i] === byte);
          if (!png || bytes.subarray(-8, -4).toString("ascii") !== "IEND") bad.push(`${where}: not a whole PNG`);
        } else if (extension === "jpg" || extension === "jpeg") {
          const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
          if (!jpeg || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9)
            bad.push(`${where}: not a whole JPEG`);
        } else if (extension === "webp") {
          const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
          if (!webp || bytes.readUInt32LE(4) + 8 !== bytes.length) bad.push(`${where}: not a whole WebP`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
