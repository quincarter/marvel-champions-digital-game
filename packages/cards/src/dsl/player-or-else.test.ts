/**
 * `playerOrElse(first, otherwise)` compiles to the engine's `PlayerRef orElse` (owner decision Q64: The Search for
 * Spiral, `mojo` 39016, reveals for the player who removed the threat, else the first player). The engine's
 * `or-else-player-ref.test.ts` and `wave6/mojo/spiral.test.ts` drive the behaviour.
 */

import { describe, expect, it } from "vitest";
import { forcedResponse } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { revealCard, scenarioDeck, selectCards } from "./effects.js";
import { chosen, eventPlayer, firstPlayer, playerOrElse } from "./values.js";

describe("playerOrElse", () => {
  it("compiles to PlayerRef orElse, nesting as given", () => {
    expect(playerOrElse(eventPlayer, firstPlayer)).toEqual({
      kind: "orElse",
      first: { kind: "eventPlayer" },
      otherwise: { kind: "firstPlayer" },
    });
  });

  it("validates inside a reveal", () => {
    const definition = forcedResponse(
      { on: "removeThreat", selfIs: "target" },
      selectCards("top", scenarioDeck("show", { top: 1 })),
      revealCard(chosen("top"), playerOrElse(eventPlayer, firstPlayer)),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });
});
