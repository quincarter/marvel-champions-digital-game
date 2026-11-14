import { describe, expect, it } from "vitest";
import { encounterSetAside, heroAction, moveCards, validateDefinition } from "./index.js";

/** `moveCards(…, { encounterTop })` (Double-Cross 63034): only "encounterDeckShuffle" reads it. */
describe("moveCards encounterTop", () => {
  it("compiles to EffectSpec moveCards.encounterTop and validates with encounterDeckShuffle", () => {
    const effect = moveCards(encounterSetAside(), "encounterDeckShuffle", undefined, { encounterTop: 10 });
    expect(effect).toMatchObject({ kind: "moveCards", encounterTop: { kind: "const", value: 10 } });
    expect(validateDefinition(heroAction(effect))).toEqual([]);
  });

  it("is refused with any other destination", () => {
    const effect = moveCards(encounterSetAside(), "discard", undefined, { encounterTop: 10 });
    expect(validateDefinition(heroAction(effect))).toContain(
      'moveCards encounterTop is only for to: "encounterDeckShuffle"',
    );
  });
});
