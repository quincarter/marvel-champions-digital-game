import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  BADGE_FOCUS,
  DEFAULT_BADGE_FOCUS,
  SPLASH_FALLBACK_FOCUS,
  TEAM_UP_ART,
  badgeFocusFor,
  parseTeamUpArt,
  teamUpArtFor,
  teamUpSlug,
} from "./team-up-art.js";
import { badgeCropRect } from "../view/badge-crop.js";

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

describe("badgeFocusFor", () => {
  test("a supplied closeup defaults to the whole picture, centered", () => {
    expect(badgeFocusFor("team-up-art:teamups/gambit-rogue/badge.webp")).toEqual(DEFAULT_BADGE_FOCUS);
    expect(DEFAULT_BADGE_FOCUS.zoom).toBe(1);
  });

  test("the full picture standing in for a closeup looks toward the faces", () => {
    expect(badgeFocusFor("team-up-art:teamups/gambit-rogue/splash.jpg")).toEqual(SPLASH_FALLBACK_FOCUS);
  });

  test("a per-pair entry wins, and every entry names a pair folder with the picture it is cut from", () => {
    for (const [slug, spec] of Object.entries(BADGE_FOCUS)) {
      const art = TEAM_UP_ART.pairs.get(slug);
      const picture = spec.source === "splash" ? art?.splash : art?.badge;
      expect(picture).toBeTruthy();
      expect(badgeFocusFor(picture?.key ?? "")).toEqual(spec);
    }
  });

  test("a pair cut from its full picture shows that picture in place of the closeup", () => {
    const art = teamUpArtFor(TEAM_UP_ART, ["Iron Man", "War Machine"]);
    expect(art?.badge).toEqual(art?.splash);
    expect(teamUpArtFor(TEAM_UP_ART, ["Gambit", "Rogue"])?.badge).not.toEqual(
      teamUpArtFor(TEAM_UP_ART, ["Gambit", "Rogue"])?.splash,
    );
  });

  test("every crop stays inside the picture it is cut from, in every pair's real art", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/teamups");
    for (const folder of readdirSync(root).filter((name) => !name.startsWith("_"))) {
      const spec = BADGE_FOCUS[folder] ?? DEFAULT_BADGE_FOCUS;
      const file = readdirSync(join(root, folder)).find((name) => name.startsWith(`${spec.source ?? "badge"}.`))!;
      const size = imageSize(readFileSync(join(root, folder, file)));
      const rect = badgeCropRect(size, spec);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 1e-6);
      expect(rect.y + rect.height).toBeLessThanOrEqual(size.height + 1e-6);
    }
  });
});

/** Pixel size from a PNG, JPEG or WebP header (no decoder in Node). */
function imageSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.toString("latin1", 1, 4) === "PNG")
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.toString("latin1", 0, 4) === "RIFF") {
    const kind = bytes.toString("latin1", 12, 16);
    if (kind === "VP8X") return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
    if (kind === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  let at = 2;
  while (at < bytes.length) {
    const marker = bytes[at + 1]!;
    if (marker >= 0xc0 && marker <= 0xc3)
      return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  throw new Error("unrecognized image");
}
