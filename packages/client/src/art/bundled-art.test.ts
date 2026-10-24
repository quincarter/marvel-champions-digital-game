import { describe, expect, test } from "vitest";
import { POOL_CARDS } from "../content/pool-cards.js";
import { POOL_CARDS as POOL_CARDS_FROM_POOL } from "../content/pool.js";
import { CARD_BACKS, STAND_IN_ART, artFor, artPathOf, type CardFace } from "./art-source.js";
import { bundledArtPaths } from "./bundled-art.js";

/**
 * What is actually in `assets/card-art/`, as paths relative to it. A lazy glob:
 * only its keys are read, nothing is loaded — and it needs no Node typings,
 * which this package deliberately doesn't carry.
 */
const ART_PREFIX = "../../../../assets/card-art/";
const ON_DISK: ReadonlySet<string> = new Set(
  Object.keys(import.meta.glob("../../../../assets/card-art/**/*")).map((key) => key.slice(ART_PREFIX.length)),
);

/**
 * Scans the pool references that are not in `assets/card-art/` yet. MarvelCDB
 * serves all of them; the download simply skipped the second face of these
 * double-sided records. Empty this list once they are fetched — the test below
 * then guards the folder against any gap at all.
 */
// Every one of these was fetched by 2026-10-24; the faces that have no scan at all are listed in docs/missing-card-art.md.
const KNOWN_MISSING: readonly string[] = [];

describe("bundledArtPaths", () => {
  test("the build reads the same pool the app runs", () => {
    expect(POOL_CARDS).toBe(POOL_CARDS_FROM_POOL);
  });

  test("always carries the three card backs and the stand-in pictures, even for an empty pool", () => {
    expect(bundledArtPaths([])).toEqual([...Object.values(CARD_BACKS), ...STAND_IN_ART].map(artPathOf).sort());
  });

  test("every stand-in picture is a file in assets/card-art (#291)", () => {
    for (const art of STAND_IN_ART) {
      expect(ON_DISK.has(artPathOf(art))).toBe(true);
    }
  });

  test("is sorted and free of duplicates", () => {
    const paths = bundledArtPaths(POOL_CARDS);
    expect([...paths]).toEqual([...new Set(paths)].sort());
  });

  test("carries every picture the table can ask any pool card for", () => {
    // Faces enumerated here by brute force, independently of `allArtFor`, so this
    // checks the bundle against the loader rather than against itself. Out-of-range
    // indices are harmless: `artFor` clamps them to a face that exists.
    const faces: CardFace[] = [{ kind: "front" }, { kind: "hero" }, { kind: "alterEgo" }, { kind: "flipSide" }];
    for (let stageIndex = 0; stageIndex < 6; stageIndex++) {
      for (let sideIndex = 0; sideIndex < 3; sideIndex++) faces.push({ kind: "villainStage", sideIndex, stageIndex });
      faces.push(
        { kind: "mainSchemeStage", stageIndex, side: "A" },
        { kind: "mainSchemeStage", stageIndex, side: "B" },
      );
    }
    const bundled = new Set(bundledArtPaths(POOL_CARDS));
    const unbundled = new Set<string>();
    for (const card of POOL_CARDS) {
      for (const face of faces) {
        const art = artFor(card, face);
        if (art && !bundled.has(artPathOf(art))) unbundled.add(`${card.id as string}: ${artPathOf(art)}`);
      }
    }
    expect([...unbundled]).toEqual([]);
  });

  test("every scan it names is in assets/card-art/, bar the known gaps", () => {
    expect(ON_DISK.size).toBeGreaterThan(0); // a glob that matched nothing would make this test vacuous
    const missing = bundledArtPaths(POOL_CARDS).filter((relative) => !ON_DISK.has(relative));
    const unexpected = missing.filter((relative) => !KNOWN_MISSING.includes(relative));
    expect(unexpected).toEqual([]);
  });
});
