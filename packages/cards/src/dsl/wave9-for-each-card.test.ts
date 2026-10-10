import { describe, expect, it } from "vitest";
import {
  chooseOne,
  chosen,
  dealDamage,
  each,
  exhaust,
  exists,
  firstPlayer,
  forEachCard,
  heroAction,
  option,
  placeThreat,
  query,
  theMainScheme,
  validateDefinition,
} from "./index.js";

const MINE = each(query("character", { controller: "you" }));
const exhaustOrThreat = chooseOne(
  option(
    "Exhaust that character",
    { when: exists(query("character", { inSlot: "character", exhausted: false })) },
    exhaust(chosen("character")),
  ),
  option("Place 1 threat", placeThreat(1, theMainScheme)),
);

describe("forEachCard: 'For each X, … that X' (Security Cameras, aos 50097; RRG 1.8 \"'For Each'\", p. 20)", () => {
  it("builds the effect: the set, the pass's slot and the repeated effects, flattened", () => {
    expect(forEachCard("character", MINE, exhaust(chosen("character")), [placeThreat(1, theMainScheme)])).toEqual({
      kind: "forEachCard",
      cards: MINE,
      slot: "character",
      effects: [exhaust(chosen("character")), placeThreat(1, theMainScheme)],
    });
  });

  it("a chooser other than you is carried; an effect is never mistaken for the options", () => {
    const built = forEachCard("character", MINE, { chooser: firstPlayer }, exhaustOrThreat);
    expect(built).toMatchObject({ chooser: firstPlayer, effects: [exhaustOrThreat] });
    expect(forEachCard("character", MINE, exhaustOrThreat)).not.toHaveProperty("chooser");
  });

  it("validates: the pass reads its own card, in an effect and in an option's condition", () => {
    expect(validateDefinition(heroAction(forEachCard("character", MINE, exhaustOrThreat)))).toEqual([]);
  });

  it("refuses an effect after the loop that reads a pass's card", () => {
    const problems = validateDefinition(
      heroAction(forEachCard("character", MINE, exhaust(chosen("character"))), dealDamage(1, chosen("character"))),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/character/);
  });

  it("refuses a slot the ability already bound, an empty slot name and no effects", () => {
    const rebound = validateDefinition(
      heroAction(forEachCard("character", MINE, forEachCard("character", MINE, exhaust(chosen("character"))))),
    );
    expect(rebound).toHaveLength(1);
    expect(rebound[0]).toMatch(/already bound/);
    expect(validateDefinition(heroAction(forEachCard("", MINE, placeThreat(1, theMainScheme))))[0]).toMatch(
      /needs a slot name/,
    );
    expect(validateDefinition(heroAction(forEachCard("character", MINE)))[0]).toMatch(/repeats no effects/);
  });
});
