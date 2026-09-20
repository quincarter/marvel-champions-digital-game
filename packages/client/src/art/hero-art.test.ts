import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import * as content from "@mc/content";
import { HERO_ART, heroArtFor, parseHeroArt } from "./hero-art.js";

describe("parseHeroArt", () => {
  test("the folder's id prefix is the lookup; the slug is ignored; variants collect", () => {
    const catalog = parseHeroArt({ "../art/heroes/01001a-spider-man/hero.jpg": "/a", "../art/heroes/01001a-spider-man/hero-2.png": "/b", "../art/heroes/51001a-black-panther-shuri/hero.webp": "/c" });
    expect(catalog.heroes.get("01001a")?.map((p) => p.url)).toEqual(["/b", "/a"]);
    expect(heroArtFor(catalog, "51001a", () => 0)?.url).toBe("/c");
    expect(heroArtFor(catalog, "99999a")).toBeNull();
  });

  test("a misnamed file is reported, and a _holding folder is never read", () => {
    const catalog = parseHeroArt({ "../art/heroes/01001a-spider-man/spidey.jpg": "/a", "../art/heroes/_pending/phoenix.jpeg": "/b" });
    expect(catalog.unrecognized).toEqual(["heroes/01001a-spider-man/spidey.jpg"]);
    expect(catalog.heroes.size).toBe(0);
  });
});

describe("the real art/heroes folder", () => {
  const identityIds = new Set<string>();
  for (const [name, value] of Object.entries(content)) {
    if (!name.endsWith("_CARDS") || !Array.isArray(value)) continue;
    for (const card of value as { id: string; type: string }[]) if (card.type === "hero_identity") identityIds.add(card.id);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/heroes");
  const folders = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith("_")).map((entry) => entry.name);

  test("has pictures, and every file fits the slot", () => {
    expect(HERO_ART.heroes.size).toBeGreaterThan(0);
    expect(HERO_ART.unrecognized).toEqual([]);
  });

  test("every folder (empty ones included) is named for a real hero identity card id", () => {
    expect(folders.filter((name) => !identityIds.has(name.split("-")[0]!))).toEqual([]);
  });
});
