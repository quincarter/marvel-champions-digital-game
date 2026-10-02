/**
 * docs/phase7-wave6.md §3.18: main scheme stages shuffled at setup. `shuffleMainSchemeStages(1)` emits the effect the
 * engine stores as `MainSchemeState.stageOrder` (`shuffled-main-scheme-stages.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { setup } from "./abilities.js";
import { shuffleMainSchemeStages } from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.18 `shuffleMainSchemeStages`", () => {
  it("The Brotherhood Strikes! 1A's shape: 'Shuffle all copies of main scheme 2A and stack them under this scheme'", () => {
    const definition = setup(shuffleMainSchemeStages(1));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([{ kind: "shuffleMainSchemeStages", fromStageIndex: 1 }]);
  });
});
