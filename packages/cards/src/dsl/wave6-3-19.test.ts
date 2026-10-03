/**
 * docs/phase7-wave6.md §3.19: a main scheme stage in the victory display. `addMainSchemeStageToVictoryDisplay()` emits
 * the effect the engine resolves (`main-scheme-stage-victory-display.test.ts` drives it); the loss at three is a
 * `stateCheck` on `victoryDisplayCount(mainScheme)`.
 */

import { describe, expect, it } from "vitest";
import { stateCheck, whenCompleted, whenRevealed } from "./abilities.js";
import { addMainSchemeStageToVictoryDisplay, advanceMainScheme, endGame } from "./effects.js";
import { query, theMainScheme, valueAtLeast, victoryDisplayCount } from "./values.js";
import { validateDefinition } from "./validate.js";

describe("§3.19 `addMainSchemeStageToVictoryDisplay`", () => {
  it("1B's shape: add this card to the victory display, then advance to the next card in the main scheme deck", () => {
    const definition = whenRevealed(addMainSchemeStageToVictoryDisplay(), advanceMainScheme());
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([{ kind: "addMainSchemeStageToVictoryDisplay" }, { kind: "advanceMainScheme" }]);
  });

  it("a 2B's shape: When Completed adds it (the completion advances); the loss at three is a state check", () => {
    const completed = whenCompleted(addMainSchemeStageToVictoryDisplay(theMainScheme));
    expect(validateDefinition(completed)).toEqual([]);
    expect(completed.effects).toEqual([{ kind: "addMainSchemeStageToVictoryDisplay", scheme: { kind: "mainScheme" } }]);
    const loss = stateCheck(valueAtLeast(victoryDisplayCount(query("mainScheme")), 3), endGame("loss"));
    expect(validateDefinition(loss)).toEqual([]);
  });
});
