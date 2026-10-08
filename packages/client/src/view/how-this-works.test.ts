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
    expect(named("40130")).toBe("Hope Summers");
    expect(named("44046")).toBe("Break Time");
    expect(named("44032")).toBe("The Merc with the Mouth");
    expect(named("40132")).toBe("Black Tom Cassidy");
    expect(named("40043")).toBe("Jackpot!");
    expect(named("45007")).toBe("Concussive Blast");
    expect(named("45032")).toBe("Limbo");
    expect(named("46016")).toBe("Take That!");
    expect(named("47023")).toBe("Grounded");
    expect(named("48006")).toBe("Bamf!");
    expect(named("49007")).toBe("Wrapped in Metal");
    expect(named("49019")).toBe('"You Got This!"');
    expect(named("45171a")).toBe("Mission Team");
  });

  test("the wave 8 hero and scenario cards carry notes that name the mechanic", () => {
    const note = (id: string) => howThisWorksFor(CARDS_BY_ID.get(id));
    expect(note("45001a")).toMatch(/Resource cards/);
    expect(note("46001a")).toMatch(/Frostbite/);
    expect(note("47007a")).toMatch(/different resource types/);
    expect(note("48006")).toMatch(/basic defense/);
    expect(note("49001a")).toMatch(/MAGNETIC/);
    expect(note("45081a")).toMatch(/another villain/);
    expect(note("45170a")).toMatch(/cannot thwart/);
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
