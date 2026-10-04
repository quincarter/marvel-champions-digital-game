/**
 * docs/phase7-wave6.md §3.65: the DSL side of "Each other encounter card gains incite 1" (Dial M for Mojo, `mojo` 39035)
 * and "Each encounter card gains peril" (The One with the Breakup, 39064). The engine's
 * `villain-new-face-reveal.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { constant, gainsKeyword } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { ENCOUNTER_CARD, ENCOUNTER_CARD_CATEGORIES, encounterCard } from "./values.js";

describe("§3.65 builders", () => {
  it("ENCOUNTER_CARD is RRG 1.8's eight encounter card types, controlled by no player", () => {
    expect(ENCOUNTER_CARD_CATEGORIES).toHaveLength(8);
    expect(ENCOUNTER_CARD).toEqual({ categories: ENCOUNTER_CARD_CATEGORIES, controller: "encounter" });
    expect(encounterCard({ self: false })).toEqual({ ...ENCOUNTER_CARD, self: false });
  });

  it("a keyword grant over it validates", () => {
    const dial = constant(gainsKeyword({ name: "incite", value: 1 }, encounterCard({ self: false })));
    expect(dial.trigger).toMatchObject({ keywordGrants: [{ target: { ...ENCOUNTER_CARD, self: false } }] });
    expect(validateDefinition(dial)).toEqual([]);
    expect(validateDefinition(constant(gainsKeyword({ name: "peril" }, ENCOUNTER_CARD)))).toEqual([]);
  });
});
