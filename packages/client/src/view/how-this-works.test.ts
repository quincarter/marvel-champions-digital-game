import { describe, expect, test } from "vitest";
import { POOL_CARDS, CARDS_BY_ID } from "../content/pool.js";
import { HOW_THIS_WORKS_IDS, baseCardId, howThisWorksFor } from "./how-this-works.js";
import { cardInspectModel } from "./inspect-model.js";

describe("how this works notes", () => {
  test("every note belongs to a card in the pool", () => {
    const poolBases = new Set(POOL_CARDS.map((card) => baseCardId(card.id as string)));
    for (const id of HOW_THIS_WORKS_IDS) expect(poolBases.has(id), `${id} is not a pool card`).toBe(true);
  });

  test("every note is one short paraphrase, without dashes or British spellings", () => {
    for (const card of POOL_CARDS) {
      const text = howThisWorksFor(card);
      if (!text) continue;
      expect(text.length, `${card.id} note is too long`).toBeLessThanOrEqual(190);
      expect(text, `${card.id} note is not a sentence`).toMatch(/[.]$/);
      expect(text, `${card.id} uses a dash`).not.toMatch(/[–—]/);
      expect(text).not.toMatch(/colour|behaviour/i);
    }
  });

  test("a face letter never hides a note", () => {
    expect(baseCardId("34002a")).toBe("34002");
    expect(baseCardId("34002b")).toBe("34002");
    expect(baseCardId("32066")).toBe("32066");
    expect(howThisWorksFor(CARDS_BY_ID.get("34002a"))).toMatch(/UNLEASHED/);
  });

  test("the notes name the cards the mechanics are on", () => {
    const named = (id: string) => CARDS_BY_ID.get(id)?.name;
    expect(named("32005")).toBe("Titanium Muscles");
    expect(named("35002")).toBe("Wolverine's Claws");
    expect(named("39030")).toBe("Paparazzi");
    expect(named("39071")).toBe("Longshot");
    expect(named("32189")).toBe("Determined Defense");
    expect(named("37001a")).toBe("Gambit");
    expect(named("38002")).toBe("Touched");
  });

  test("a card with no tricky wording has no note, and no card means no note", () => {
    expect(howThisWorksFor(CARDS_BY_ID.get("01001a"))).toBeNull();
    expect(howThisWorksFor(undefined)).toBeNull();
  });

  test("Inspect's no-game sheet carries the note", () => {
    const wheel = CARDS_BY_ID.get("39026a");
    expect(wheel).toBeDefined();
    const model = cardInspectModel(wheel, "front" as never);
    expect(model.howItWorks).toMatch(/SPINNING/);
  });
});
