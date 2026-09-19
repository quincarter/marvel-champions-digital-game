import { describe, expect, test } from "vitest";
import { POOL_PACKS, POOL_SCENARIOS } from "../content/pool.js";
import { ART_CATALOG, outcomeArtFor, packCoverFor, parseArtCatalog, villainArtFor } from "./scenario-art.js";

const catalog = parseArtCatalog({
  "../../art/scenarios/ultron/villain.jpg": "/u.jpg",
  "../../art/scenarios/ultron/villain-2.png": "/u2.png",
  "../../art/scenarios/ultron/villain-wins.jpg": "/uw.jpg",
  "../../art/scenarios/ultron/villain-wins-2.jpg": "/uw2.jpg",
  "../../art/scenarios/klaw/villain-loses.jpg": "/kl.jpg",
  "../../art/scenarios/rhino/villian.jpg": "/typo.jpg",
  "../../art/scenarios/rhino/extra/villain.jpg": "/nested.jpg",
  "../../art/outcomes/defeat.avif": "/defeat.avif",
  "../../art/outcomes/shrug.png": "/shrug.png",
  "../../art/packs/core/cover.jpg": "/core-cover.jpg",
  "../../art/packs/core/cover-2.png": "/core-cover-2.png",
  "../../art/packs/twc/covr.jpg": "/typo-pack.jpg",
});
const first = (): number => 0;

describe("parseArtCatalog", () => {
  test("files land in the slot their name says, variants included", () => {
    const ultron = catalog.scenarios.get("ultron")!;
    expect(ultron.villain.map((p) => p.url)).toEqual(["/u2.png", "/u.jpg"]);
    // Longest slot first: `villain-wins-2` is a variant of villain-wins, not of villain.
    expect(ultron["villain-wins"].map((p) => p.url)).toEqual(["/uw2.jpg", "/uw.jpg"]);
    expect(ultron["villain-loses"]).toEqual([]);
    expect(catalog.outcomes.defeat.map((p) => p.url)).toEqual(["/defeat.avif"]);
  });

  test("texture keys are the path under art/, so they are unique and stable", () => {
    expect(catalog.scenarios.get("klaw")!["villain-loses"][0]!.key).toBe("scene-art:scenarios/klaw/villain-loses.jpg");
  });

  test("a file that fits no slot is reported, never silently dropped or misfiled", () => {
    expect(catalog.unrecognized).toEqual(["outcomes/shrug.png", "packs/twc/covr.jpg", "scenarios/rhino/extra/villain.jpg", "scenarios/rhino/villian.jpg"]);
    expect(catalog.scenarios.has("rhino")).toBe(false);
  });

  test("pack covers land in the packs map, variants included, sorted the same way scenario art is", () => {
    expect(catalog.packs.get("core")!.cover.map((p) => p.url)).toEqual(["/core-cover-2.png", "/core-cover.jpg"]);
    expect(catalog.packs.has("twc")).toBe(false); // its only file was a typo, unrecognized rather than misfiled
  });
});

describe("packCoverFor", () => {
  test("a pack's own cover art, or null when it has none", () => {
    expect(packCoverFor(catalog, "core", first)?.url).toBe("/core-cover-2.png");
    expect(packCoverFor(catalog, "twc", first)).toBeNull();
  });
});

describe("outcomeArtFor", () => {
  test("a loss shows the villain winning; a win shows it losing", () => {
    expect(outcomeArtFor(catalog, "ultron", "loss", first)?.url).toBe("/uw2.jpg");
    expect(outcomeArtFor(catalog, "klaw", "win", first)?.url).toBe("/kl.jpg");
  });

  test("a scenario with no scene of its own falls back to the generic one", () => {
    expect(outcomeArtFor(catalog, "klaw", "loss", first)?.url).toBe("/defeat.avif");
    expect(outcomeArtFor(catalog, "mutagen-formula", "loss", first)?.url).toBe("/defeat.avif");
  });

  test("nothing to show is null, not a wrong picture", () => {
    expect(outcomeArtFor(catalog, "ultron", "win", first)).toBeNull(); // no villain-loses, no generic victory
  });

  test("a concession never shows the villain's victory scene", () => {
    expect(outcomeArtFor(catalog, "ultron", "conceded", first)?.url).toBe("/defeat.avif");
  });
});

describe("villainArtFor", () => {
  test("the scenario's own villain artwork, or null", () => {
    expect(villainArtFor(catalog, "ultron", first)?.url).toBe("/u2.png");
    expect(villainArtFor(catalog, "klaw", first)).toBeNull();
  });
});

describe("the real art/ folder", () => {
  test("has something in it (a glob that matched nothing would make the guards below vacuous)", () => {
    expect(ART_CATALOG.scenarios.size).toBeGreaterThan(0);
  });

  test("every file fits a slot", () => {
    expect(ART_CATALOG.unrecognized).toEqual([]);
  });

  test("every scenario folder is named for a real scenario id", () => {
    const ids = new Set(POOL_SCENARIOS.map((scenario) => scenario.id as string));
    expect([...ART_CATALOG.scenarios.keys()].filter((id) => !ids.has(id))).toEqual([]);
  });

  test("every pack folder (if any) is named for a real pack code", () => {
    const codes = new Set(POOL_PACKS.map((pack) => pack.code as string));
    expect([...ART_CATALOG.packs.keys()].filter((code) => !codes.has(code))).toEqual([]);
  });
});
