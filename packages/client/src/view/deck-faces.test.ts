import { describe, expect, test } from "vitest";
import type { AnyCard, Deck } from "@mc/content";
import { CARDS_BY_ID, POOL_CARDS } from "../content/pool.js";
import { cardFaceTiles, deckFaceGroupLayout, deckFaceGroups, identityFaceTiles } from "./deck-faces.js";

const ant = CARDS_BY_ID.get("12001a")!;
const entry = (cardId: string) => ({ cardId, quantity: 1 }) as unknown as Deck["cards"][number];
const deckOf = (identity: string, ...cards: string[]) =>
  ({ identityCardId: identity, cards: cards.map(entry) }) as unknown as Pick<Deck, "identityCardId" | "cards">;
const hasFlip = (c: AnyCard): boolean => "flipSide" in c && !!c.flipSide;
const twoSided = POOL_CARDS.find((c) => hasFlip(c) && "aspect" in c)!;
const plain = POOL_CARDS.find((c) => c.type === "event" && !hasFlip(c))!;

describe("identity faces", () => {
  test("a three-faced identity lists Hero, Alter-Ego and the extra form, in order", () => {
    if (ant.type !== "hero_identity") throw new Error("not an identity");
    const tiles = identityFaceTiles(ant);
    expect(tiles.map((t) => t.face.kind)).toEqual(["hero", "alterEgo", "heroForm"]);
    expect(tiles.map((t) => t.label)).toEqual(["Hero", "Alter-Ego", "Hero form"]);
    expect(tiles[1]!.name).toBe("Scott Lang");
    expect(new Set([tiles[0]!.name, tiles[2]!.name]).size).toBe(2);
  });

  test("a two-faced identity lists Hero then Alter-Ego", () => {
    const hero = POOL_CARDS.find((c) => c.type === "hero_identity" && !c.additionalHeroForms?.length)!;
    if (hero.type !== "hero_identity") throw new Error("not an identity");
    expect(identityFaceTiles(hero).map((t) => t.face.kind)).toEqual(["hero", "alterEgo"]);
  });
});

describe("card faces", () => {
  test("a single-faced card is one front tile", () => {
    expect(cardFaceTiles(plain).map((t) => t.face.kind)).toEqual(["front"]);
  });

  test("a double-sided player card lists its front and its back", () => {
    expect(twoSided).toBeDefined();
    const tiles = cardFaceTiles(twoSided);
    expect(tiles.map((t) => t.face.kind)).toEqual(["front", "flipSide"]);
    expect(tiles[1]!.name).toBe((twoSided as { flipSide: { name: string } }).flipSide.name);
  });
});

describe("deck face groups", () => {
  test("the identity comes first, single-faced cards are left out, a two-sided card follows once", () => {
    const groups = deckFaceGroups(
      deckOf("12001a", plain.id as string, twoSided.id as string, twoSided.id as string),
      CARDS_BY_ID,
    );
    expect(groups.map((g) => g.key)).toEqual(["identity", twoSided.id]);
    expect(groups[0]!.tiles).toHaveLength(3);
  });

  test("an empty card list still lists the identity's faces", () => {
    const groups = deckFaceGroups(deckOf("12001a"), CARDS_BY_ID);
    expect(groups.map((g) => g.key)).toEqual(["identity"]);
    expect(groups[0]!.tiles.length).toBeGreaterThan(0);
  });

  test("a deck whose identity is not in the pool lists no identity", () => {
    expect(deckFaceGroups(deckOf("nope"), CARDS_BY_ID)).toEqual([]);
  });
});

describe("face group layout", () => {
  test("three tiles share a phone row; a fifth wraps to a second row", () => {
    const three = deckFaceGroupLayout(343, 3);
    expect(new Set(three.tiles.map((t) => t.y)).size).toBe(1);
    const five = deckFaceGroupLayout(343, 5);
    expect(new Set(five.tiles.map((t) => t.y)).size).toBe(2);
    expect(five.height).toBeGreaterThan(three.height);
  });

  test("every tile stays inside the width", () => {
    for (const width of [300, 343, 600, 900])
      for (const rect of deckFaceGroupLayout(width, 4).tiles) expect(rect.x + rect.width).toBeLessThanOrEqual(width);
  });
});
