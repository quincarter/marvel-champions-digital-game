import { describe, expect, it } from "vitest";
import { setCardCaption, setCardsSubtitle } from "./set-cards.js";

describe("set cards wording", () => {
  it("counts the whole set and the different cards", () => {
    expect(setCardsSubtitle(12, 8)).toBe("12 cards, 8 different. Tap a card to read it.");
  });

  it("shows a copy count only past one", () => {
    expect(setCardCaption(1, "Treachery")).toBe("Treachery");
    expect(setCardCaption(2, "Minion")).toBe("x2 · Minion");
  });
});
