import { describe, expect, it } from "vitest";
import { PLAYABLE_CARDS } from "../data/index.js";
import type { AnyCard } from "./cards/index.js";
import { applyTraitAdditions, officialCardsByPictureCode, officialFaceOfCode } from "./house-rules.js";
import { PACK_KINDS } from "./packs.js";

const byId = new Map(PLAYABLE_CARDS.map((card) => [card.id as string, card]));
const identity = (cards: readonly AnyCard[], id: string) => {
  const card = cards.find((one) => (one.id as string) === id);
  if (card?.type !== "hero_identity") throw new Error(`${id} is not a hero identity`);
  return card;
};

describe("house-rule packs (docs/custom-content-packs.md §11.11)", () => {
  it("is a pack kind of its own", () => {
    expect(PACK_KINDS).toContain("house-rule");
  });

  it("reads a face code as a card's front or a hero identity's alter-ego", () => {
    expect(officialFaceOfCode("01001a", byId)).toMatchObject({ side: "front" });
    expect(officialFaceOfCode("14001b", byId)).toMatchObject({ side: "alterEgo" });
    expect(officialFaceOfCode("14001b", byId)?.card.id).toBe("14001a");
    expect(officialFaceOfCode("99999a", byId)).toBeUndefined();
  });

  it("adds a trait to the face it names, and only there (Lost Traits: Spider-Man, Pietro Maximoff)", () => {
    const changed = applyTraitAdditions(PLAYABLE_CARDS, [
      { code: "01001a", traits: ["Web-Warrior"] },
      { code: "14001b", traits: ["Mutant"] },
    ]);
    const spider = identity(changed, "01001a");
    expect(spider.hero.traits).toEqual(["AVENGER", "WEB-WARRIOR"]);
    expect(spider.alterEgo.traits).toEqual(identity(PLAYABLE_CARDS, "01001a").alterEgo.traits);
    const pietro = identity(changed, "14001a");
    expect(pietro.alterEgo.traits).toContain("MUTANT");
    expect(pietro.hero.traits).toEqual(identity(PLAYABLE_CARDS, "14001a").hero.traits);
    // The printed pool is untouched.
    expect(identity(PLAYABLE_CARDS, "01001a").hero.traits).toEqual(["AVENGER"]);
  });

  it("never doubles a trait the face already has, and returns the same array when nothing changes", () => {
    const once = applyTraitAdditions(PLAYABLE_CARDS, [{ code: "01001a", traits: ["Avenger", "avenger"] }]);
    expect(identity(once, "01001a").hero.traits).toEqual(["AVENGER"]);
    expect(applyTraitAdditions(PLAYABLE_CARDS, [])).toBe(PLAYABLE_CARDS);
    expect(applyTraitAdditions(PLAYABLE_CARDS, [{ code: "99999a", traits: ["Mutant"] }])).toBe(PLAYABLE_CARDS);
  });

  it("knows every printed picture code, a scheme's stage faces included (GMW Fixes: 16107b)", () => {
    const pictures = officialCardsByPictureCode(PLAYABLE_CARDS);
    expect(pictures.get("16107b")?.id).toBe("16106a");
    expect(pictures.get("16071")?.id).toBe("16070");
    expect(pictures.get("01001b")?.id).toBe("01001a");
    expect(pictures.has("99999a")).toBe(false);
    expect(officialCardsByPictureCode(PLAYABLE_CARDS)).toBe(pictures);
  });
});
