/**
 * docs/phase7-wave7.md §3.28: alternative main scheme stages, one removed at random and the rest in a random order.
 * `removeMainSchemeStages` and `shuffleMainSchemeStageGroup` emit the effects the engine resolves
 * (`random-main-scheme-stage-removal.test.ts` drives them). A stage's "When Completed: Advance to the other stage 2A.
 * If you cannot, advance to stage 3A" has no builder: it is the default advance over the stored order.
 */

import { describe, expect, it } from "vitest";
import { whenRevealed } from "./abilities.js";
import {
  advanceMainScheme,
  removeMainSchemeStages,
  shuffleMainSchemeStageGroup,
  shuffleMainSchemeStages,
} from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.28 `removeMainSchemeStages` and `shuffleMainSchemeStageGroup`", () => {
  it("the stage 1B's shape: 'Remove 1 random stage 2 from the game. Then advance to a random stage 2A.'", () => {
    const definition = whenRevealed(removeMainSchemeStages(2), shuffleMainSchemeStageGroup(2), advanceMainScheme());
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      { kind: "removeMainSchemeStages", stageNumber: 2, random: { kind: "const", value: 1 } },
      { kind: "shuffleMainSchemeStages", fromStageIndex: 0, stageNumber: 2 },
      { kind: "advanceMainScheme" },
    ]);
  });

  it("the other forms: a count, a value, a bind; a group shuffled from an index on", () => {
    expect(removeMainSchemeStages(3, 2)).toEqual({
      kind: "removeMainSchemeStages",
      stageNumber: 3,
      random: { kind: "const", value: 2 },
    });
    expect(removeMainSchemeStages(2, { kind: "mainSchemeStageNumber" }, { bind: "gone" })).toEqual({
      kind: "removeMainSchemeStages",
      stageNumber: 2,
      random: { kind: "mainSchemeStageNumber" },
      bind: "gone",
    });
    expect(shuffleMainSchemeStages(1, { stageNumber: 2 })).toEqual({
      kind: "shuffleMainSchemeStages",
      fromStageIndex: 1,
      stageNumber: 2,
    });
    // Without a stage number the wave 6 shape is unchanged.
    expect(shuffleMainSchemeStages(1)).toEqual({ kind: "shuffleMainSchemeStages", fromStageIndex: 1 });
  });
});
