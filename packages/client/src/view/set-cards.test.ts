import { describe, expect, it } from "vitest";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { cardsBySet, setFacesOf } from "./civil-war-builder-art.js";
import { setSheetFor } from "./civil-war-builder-model.js";
import { setCardCaption, setCardsSubtitle } from "./set-cards.js";

describe("set cards wording", () => {
  it("counts the whole set and the different cards", () => {
    expect(setCardsSubtitle(12, 8)).toBe("12 cards, 8 different. Tap a card to read it.");
    expect(setCardsSubtitle(1, 1)).toBe("1 card. Tap it to read it.");
  });

  it("shows a copy count only past one", () => {
    expect(setCardCaption(1, "Treachery")).toBe("Treachery");
    expect(setCardCaption(2, "Minion")).toBe("x2 · Minion");
  });
});

describe("an extra modular set made of a scenario-specific player card", () => {
  it("Longshot's sheet lists its one ally (it read as 0 cards), and the set has a picture", () => {
    const sheet = setSheetFor({ cards: CARDS_BY_ID, encounterSets: POOL_ENCOUNTER_SETS }, "longshot");
    expect(sheet.cards.map((card) => [card.face.name, card.typeWord])).toEqual([["Longshot", "Ally"]]);
    expect(sheet.totalCards).toBe(1);
    expect(setFacesOf(cardsBySet(CARDS_BY_ID).get("longshot") ?? [], 1)).toHaveLength(1);
  });
});
