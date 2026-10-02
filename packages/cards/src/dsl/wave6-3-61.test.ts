/**
 * docs/phase7-wave6.md §3.61: the DSL side of "At the start of step three of the villain phase (deal encounter cards)"
 * (Wheel of Genres, Stopped, `mojo` 39026b). `on.villainStepStarting` hears the engine's `villainStepStarting { step:
 * "dealEncounterCards" }`, an interrupt-only timing point announced before step three deals anything (RRG 1.8 "Villain
 * Phase", p. 47). The engine's `villain-step-starting.test.ts` drives the same trigger shape.
 */

import { describe, expect, it } from "vitest";
import { forcedInterrupt, on } from "./abilities.js";
import { dealEncounterCard, flipCard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { firstPlayer, self } from "./values.js";

describe("§3.61 on.villainStepStarting", () => {
  it("hears the start of step three, and not the end of step one", () => {
    expect(on.villainStepStarting()).toEqual({ on: "villainStepStarting", eventIs: { step: "dealEncounterCards" } });
    expect(on.villainStepStarting("dealEncounterCards")).toEqual(on.villainStepStarting());
    expect(on.villainStepStarting()).not.toEqual(on.villainStepResolved());
  });

  it("Wheel of Genres, Stopped: a Forced Interrupt that deals the first player two cards and flips this card", () => {
    const definition = forcedInterrupt(
      on.villainStepStarting(),
      dealEncounterCard(firstPlayer),
      dealEncounterCard(firstPlayer),
      flipCard(self),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "interrupt",
      forced: true,
      on: { on: "villainStepStarting", eventIs: { step: "dealEncounterCards" } },
    });
    expect(definition.effects).toEqual([
      { kind: "dealEncounterCard", player: { kind: "firstPlayer" } },
      { kind: "dealEncounterCard", player: { kind: "firstPlayer" } },
      { kind: "flipCard", target: { kind: "self" } },
    ]);
  });
});
