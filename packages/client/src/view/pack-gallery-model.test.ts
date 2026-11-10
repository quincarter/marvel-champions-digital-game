import { describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import { CORE_CARDS } from "@mc/content";
import type { ActivePackStatus } from "../packs/active-packs.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import {
  galleryCountText,
  galleryGridOf,
  galleryOf,
  galleryPictureHeight,
  loadStatusOf,
  loadStatusText,
  pageSplitOf,
} from "./pack-gallery-model.js";

const pickCards = (): readonly AnyCard[] => {
  const identity = CORE_CARDS.find((card) => card.type === "hero_identity")!;
  const others = CORE_CARDS.filter((card) => card.type === "event" || card.type === "ally").slice(0, 3);
  return [others[0]!, identity, others[1]!, others[0]!, others[2]!];
};

const pack = (cards: readonly AnyCard[]): Pick<PackRuntime, "cards"> => ({ cards });

describe("the pack gallery", () => {
  it("lists the hero identity first, then the pack's own order, each card once", () => {
    const cards = pickCards();
    const tiles = galleryOf(pack(cards));
    expect(tiles).toHaveLength(4);
    expect(tiles[0]!.cardId).toBe(cards[1]!.id);
    expect(tiles.slice(1).map((tile) => tile.cardId)).toEqual([cards[0]!.id, cards[2]!.id, cards[4]!.id]);
    for (const tile of tiles) {
      expect(tile.name.length).toBeGreaterThan(0);
      expect(tile.typeLine.length).toBeGreaterThan(0);
    }
  });

  it("is empty for a pack that is not loaded", () => {
    expect(galleryOf(undefined)).toEqual([]);
    expect(galleryOf(pack([]))).toEqual([]);
    expect(galleryCountText(1)).toBe("1 card");
    expect(galleryCountText(9)).toBe("9 cards");
  });

  it("fits columns to the width and keeps a card's proportions", () => {
    for (const [width, phone] of [
      [355, true],
      [700, false],
      [1100, false],
    ] as const) {
      const grid = galleryGridOf(width, phone);
      expect(grid.columns * grid.tileWidth + (grid.columns - 1) * grid.gap).toBeLessThanOrEqual(width + 0.5);
      expect(grid.tileWidth).toBeGreaterThanOrEqual(90);
      expect(galleryPictureHeight(grid) / grid.tileWidth).toBeCloseTo(3.5 / 2.5, 1);
      expect(grid.rowHeight).toBe(grid.tileHeight + grid.gap);
    }
    expect(galleryGridOf(355, true).columns).toBeGreaterThanOrEqual(3);
  });

  it("splits the page body into text and gallery, and gives all of it to the text when the cards cannot fit", () => {
    const split = pageSplitOf(300, 9, true);
    expect(split.gallery).not.toBeNull();
    expect(split.text.height + split.gallery!.height).toBe(300);
    expect(split.text.height).toBeGreaterThanOrEqual(84);
    expect(pageSplitOf(300, 0, true)).toEqual({ text: { height: 300 }, gallery: null });
    expect(pageSplitOf(150, 9, true)).toEqual({ text: { height: 150 }, gallery: null });
  });
});

describe("a pack's load status", () => {
  const status = (over: Partial<ActivePackStatus>): ActivePackStatus => ({
    id: "demo",
    version: "1.0.0",
    name: "Demo",
    loaded: true,
    ...over,
  });

  it("says nothing for a pack that is not installed", () => {
    expect(loadStatusOf(false, undefined)).toBeNull();
  });

  it("says it is checking while the loader has not answered", () => {
    expect(loadStatusOf(true, undefined)).toMatchObject({ state: "loading" });
  });

  it("says a loaded pack is playable, and repeats the loader's notes", () => {
    expect(loadStatusOf(true, status({}))).toMatchObject({ state: "loaded", label: "✓ Loaded" });
    const noted = loadStatusOf(true, status({ notes: ["Deck core-x ignored: that id belongs to a base game deck"] }))!;
    expect(noted.detail).toContain("Deck core-x ignored");
  });

  it("gives a skipped pack's reason in words, with a symbol so it never rests on color", () => {
    const line = loadStatusOf(true, status({ loaded: false, reason: "Needs fan-x to be installed and working" }))!;
    expect(line).toMatchObject({ state: "skipped", label: "! Not loaded" });
    expect(loadStatusText(line)).toBe("! Not loaded. Needs fan-x to be installed and working");
  });
});
