/**
 * docs/phase7-wave6.md §3.56: the DSL side of "After a MUTANT alter-ego changes into hero form" (Moira MacTaggert,
 * `rogue` 38018). `on.playerChangesForm(to, { fromTrait })` adds a `targetIs` trait clause, which the engine answers
 * from `formChanged.fromTraits` (the identity's traits on the face it left); the engine's `form-change-traits.test.ts`
 * drives the behaviour. Shapes only (Rogue's own cards are scripted elsewhere).
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { exhaustThis, on, response } from "./abilities.js";
import { draw } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { eventPlayer } from "./values.js";

const MUTANT = trait("MUTANT");

describe("§3.56 playerChangesForm fromTrait", () => {
  it("adds a targetIs trait clause; without it the pattern is unchanged", () => {
    expect(on.playerChangesForm("hero", { fromTrait: MUTANT })).toEqual({
      on: "formChanged",
      eventIs: { to: "hero", change: "identity" },
      targetIs: { trait: MUTANT },
    });
    expect(on.playerChangesForm("alterEgo")).toEqual({
      on: "formChanged",
      eventIs: { to: "alterEgo", change: "identity" },
    });
  });

  it("Moira MacTaggert's shape validates", () => {
    const definition = response(
      on.playerChangesForm("hero", { fromTrait: MUTANT }),
      { cost: exhaustThis },
      draw(1, eventPlayer),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "response",
      forced: false,
      on: { on: "formChanged", eventIs: { to: "hero", change: "identity" }, targetIs: { trait: MUTANT } },
    });
    expect(definition.cost).toEqual({ exhaustSelf: true });
    expect(definition.effects).toEqual([
      { kind: "draw", player: { kind: "eventPlayer" }, amount: { kind: "const", value: 1 } },
    ]);
  });
});
