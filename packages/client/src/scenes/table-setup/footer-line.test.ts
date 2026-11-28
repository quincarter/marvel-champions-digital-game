import { describe, expect, it } from "vitest";
import { footerLineOf } from "./footer-line.js";

describe("footerLineOf", () => {
  const facts = { villainName: "Rhino", stage: "I", difficulty: "Standard", heroes: 1, modulars: 2, blocked: null };
  it("says the villain's stage, the difficulty, the heroes and the modular sets", () => {
    expect(footerLineOf(facts)).toBe("Rhino · Stage I · Standard · 1 hero · 2 modulars");
  });
  it("says why the game cannot be dealt instead, and omits the stage before there is a preview", () => {
    expect(footerLineOf({ ...facts, blocked: "Pick 1 more set" })).toBe("Pick 1 more set");
    expect(footerLineOf({ ...facts, stage: null })).toBe("Rhino · Standard");
  });
});
