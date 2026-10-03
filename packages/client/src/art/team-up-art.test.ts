import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { TEAM_UP_ART, parseTeamUpArt, teamUpArtFor, teamUpSlug } from "./team-up-art.js";

describe("teamUpSlug", () => {
  test("lowercased, sorted, order-independent", () => {
    expect(teamUpSlug(["Rogue", "Gambit"])).toBe("gambit-rogue");
    expect(teamUpSlug(["Gambit", "Rogue"])).toBe("gambit-rogue");
  });

  test("punctuation and spaces collapse to a hyphen", () => {
    expect(teamUpSlug(["Black Panther/T'Challa", "Shuri"])).toBe("black-panther-t-challa-shuri");
  });
});

describe("parseTeamUpArt", () => {
  const catalog = parseTeamUpArt({
    "../art/teamups/gambit-rogue/splash.jpg": "/splash",
    "../art/teamups/gambit-rogue/badge.webp": "/badge",
    "../art/teamups/angel-psylocke/badge.png": "/only-badge",
    "../art/teamups/_pending/splash.jpg": "/held",
    "../art/teamups/gambit-rogue/portrait.jpg": "/typo",
  });

  test("finds both pictures for a pair, by names in either order", () => {
    expect(teamUpArtFor(catalog, ["Rogue", "Gambit"])?.splash?.url).toBe("/splash");
    expect(teamUpArtFor(catalog, ["Gambit", "Rogue"])?.badge?.url).toBe("/badge");
  });

  test("a pair with one picture has just that one", () => {
    const art = teamUpArtFor(catalog, ["Angel", "Psylocke"]);
    expect(art?.splash).toBeNull();
    expect(art?.badge?.url).toBe("/only-badge");
  });

  test("a pair with no art is null, a _holding folder is never read, and a misnamed file is reported", () => {
    expect(teamUpArtFor(catalog, ["Colossus", "Shadowcat"])).toBeNull();
    expect(catalog.pairs.has("_pending")).toBe(false);
    expect(catalog.unrecognized).toEqual(["teamups/gambit-rogue/portrait.jpg"]);
  });
});

describe("the real art/teamups folder", () => {
  test("Gambit and Rogue have both pictures, and every file fits a slot", () => {
    const art = teamUpArtFor(TEAM_UP_ART, ["Gambit", "Rogue"]);
    expect(art?.splash).not.toBeNull();
    expect(art?.badge).not.toBeNull();
    expect(TEAM_UP_ART.unrecognized).toEqual([]);
  });

  test("every folder is named for a sorted pair slug", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/teamups");
    const folders = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
      .map((entry) => entry.name);
    for (const folder of folders) expect(TEAM_UP_ART.pairs.has(folder)).toBe(true);
  });
});
