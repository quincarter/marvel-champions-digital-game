import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import * as content from "@mc/content";
import { HERO_ART, heroArtFor, parseFocus, parseHeroArt } from "./hero-art.js";
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
