import { describe, expect, it } from "vitest";
import type { AnyCard, PackPreviewDeck } from "@mc/content";
import { CORE_CARDS } from "@mc/content";
import type { ActivePackStatus } from "../packs/active-packs.js";
import {
  GALLERY_HEADING_HEIGHT,
  galleryCardCount,
  galleryCountText,
  galleryFlat,
  galleryGridOf,
  galleryPictureHeight,
  galleryRowsOf,
  gallerySectionsOf,
  loadStatusOf,
  loadStatusText,
  packPageLayoutOf,
} from "./pack-gallery-model.js";

const core = (type: string, n = 0): AnyCard => CORE_CARDS.filter((card) => card.type === type)[n]!;
const asPack = (card: AnyCard, patch: Record<string, unknown>): AnyCard => ({ ...card, ...patch }) as AnyCard;
const baseCards = new Map(CORE_CARDS.map((card) => [card.id as string, card]));
const deck = (cards: [string, number][]): { cards: PackPreviewDeck["cards"] } => ({
  cards: cards.map(([cardId, quantity]) => ({ cardId, quantity })),
});

describe("the pack gallery", () => {
  const identity = asPack(core("hero_identity"), { id: "x.demo.01a" });
  const signature = asPack(core("event"), { id: "x.demo.02", aspect: "hero:x.demo.01a" });
  const aspectCard = asPack(core("ally"), { id: "x.demo.03", aspect: "justice" });
  const minion = asPack(core("minion"), { id: "x.demo.04" });
  const obligation = asPack(core("obligation"), { id: "x.demo.05" });
  const baseAlly = core("ally", 1);

  it("groups a hero pack: hero, nemesis and obligation, then the deck with its base-game cards, with quantities", () => {
    const { sections, records } = gallerySectionsOf({
      cards: [aspectCard, minion, signature, identity, obligation, identity],
      decks: [
        deck([
          ["x.demo.02", 1],
          ["x.demo.03", 2],
          [baseAlly.id as string, 3],
          ["gone.id", 1],
        ]),
      ],
      baseCards,
    });
    expect(sections.map((section) => section.id)).toEqual(["hero", "encounter", "deck"]);
    expect(sections[0]!.cards.map((card) => card.cardId)).toEqual(["x.demo.01a", "x.demo.02"]);
    expect(sections[1]!.title).toBe("Nemesis and obligation");
    expect(sections[1]!.cards.map((card) => card.cardId)).toEqual(["x.demo.04", "x.demo.05"]);
    expect(sections[2]!.cards.map((card) => [card.cardId, card.quantity])).toEqual([
      ["x.demo.03", 2],
      [baseAlly.id, 3],
    ]);
    expect(records.get(baseAlly.id as string)).toBe(baseAlly);
    expect(galleryCardCount(sections)).toBe(6);
    for (const card of galleryFlat(sections)) {
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.typeLine.length).toBeGreaterThan(0);
    }
  });

  it("groups a scenario pack: villain and scheme, then encounter cards", () => {
    const villain = asPack(core("villain"), { id: "x.demo.01" });
    const scheme = asPack(core("main_scheme"), { id: "x.demo.02a" });
    const { sections } = gallerySectionsOf({ cards: [minion, scheme, villain], decks: [], baseCards });
    expect(sections.map((section) => [section.id, section.title])).toEqual([
      ["villain", "Villain and scheme"],
      ["encounter", "Encounter cards"],
    ]);
  });

  it("is empty for a pack with no cards", () => {
    expect(gallerySectionsOf({ cards: [], decks: [], baseCards }).sections).toEqual([]);
    expect(galleryCountText(1)).toBe("1 card");
    expect(galleryCountText(9)).toBe("9 cards");
  });

  it("lays the groups out as rows: a heading, then tiles, with flat indexes running on", () => {
    const { sections } = gallerySectionsOf({
      cards: [identity, signature, aspectCard],
      decks: [deck([["x.demo.03", 1]])],
      baseCards,
    });
    const rows = galleryRowsOf(sections, 1);
    expect(rows.map((row) => row.kind)).toEqual(["heading", "tiles", "tiles", "heading", "tiles"]);
    expect(rows.flatMap((row) => (row.kind === "tiles" ? [row.first] : []))).toEqual([0, 1, 2]);
    expect(galleryRowsOf(sections, 4).filter((row) => row.kind === "tiles")).toHaveLength(2);
    expect(GALLERY_HEADING_HEIGHT).toBeGreaterThan(0);
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
});

describe("the pack page layout", () => {
  const input = { faceCount: 2, cardCount: 20, buttonsHeight: 44 };
  const sizes = [
    ["se", 375, 667, true],
    ["pixel", 412, 924, true],
    ["tablet-portrait", 768, 1024, false],
    ["tablet", 1024, 768, false],
    ["desktop", 1280, 720, false],
  ] as const;

  it.each(sizes)(
    "at %s keeps the buttons below the gallery and everything inside the screen",
    (_name, width, height, phone) => {
      const layout = packPageLayoutOf({
        ...input,
        width,
        height,
        phone,
        gutter: phone ? 16 : 24,
        top: phone ? 52 : 60,
      });
      expect(layout.gallery).not.toBeNull();
      const list = layout.gallery!.list;
      expect(list.y + list.height).toBeLessThanOrEqual(layout.status.y);
      expect(layout.status.y + layout.status.height).toBeLessThanOrEqual(layout.buttonsY);
      expect(layout.buttonsY + 44).toBeLessThanOrEqual(height);
      expect(list.height).toBeGreaterThanOrEqual(120);
      expect(layout.text.height).toBeGreaterThanOrEqual(40);
      for (const face of layout.faces) expect(face.x + face.width).toBeLessThanOrEqual(width);
      expect(layout.title.width).toBeGreaterThanOrEqual(140);
      // Wide pages put the description beside the faces; a phone puts it under them, above the gallery.
      expect(layout.textBeside).toBe(!phone);
      if (phone) expect(layout.text.y + layout.text.height).toBeLessThanOrEqual(layout.gallery!.count.y);
    },
  );

  it("shows one square thumbnail and gives the text the body when the pack has no preview", () => {
    const layout = packPageLayoutOf({
      ...input,
      width: 375,
      height: 667,
      phone: true,
      gutter: 16,
      top: 52,
      faceCount: 0,
      cardCount: 0,
    });
    expect(layout.squareThumb).toBe(true);
    expect(layout.faces).toHaveLength(1);
    expect(layout.gallery).toBeNull();
    expect(layout.text.y + layout.text.height).toBeLessThanOrEqual(layout.status.y);
  });

  it("drops the gallery when the screen cannot hold a row of tiles", () => {
    expect(
      packPageLayoutOf({ ...input, width: 667, height: 375, phone: true, gutter: 16, top: 52 }).gallery,
    ).toBeNull();
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
