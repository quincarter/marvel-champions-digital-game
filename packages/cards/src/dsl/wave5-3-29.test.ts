/**
 * docs/phase7-wave5.md §3.29: replacing damage with counters on another card composes from existing builders. Bell
 * Tower's Quiet side (`sm` 27077a): "Interrupt: When any amount of damage would be dealt to Venom by an attack, (you
 * may) place that many chime counters here instead." This proves the composition validates and emits exactly the plain
 * data `packages/engine/src/damage-to-counters.test.ts` drives.
 */

import { describe, expect, it } from "vitest";
import { interrupt, when } from "./abilities.js";
import { addCounters, instead } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { eventAmount, query } from "./values.js";

describe("§3.29 Bell Tower (Quiet)", () => {
  it("interrupt(when.damage(Venom, fromAttack), instead(addCounters('chime', eventAmount)))", () => {
    const quiet = interrupt(
      when.damage(query("villain", { name: "Venom" }), { fromAttack: true }),
      instead(addCounters("chime", eventAmount)),
    );
    expect(validateDefinition(quiet)).toEqual([]);
    expect(quiet.trigger).toEqual({
      kind: "interrupt",
      forced: false,
      on: { on: "dealDamage", targetIs: { categories: ["villain"], name: "Venom" }, fromAttack: true },
    });
    expect(quiet.effects).toEqual([
      {
        kind: "replaceTriggeringEvent",
        with: [
          { kind: "addCounters", target: { kind: "self" }, counterType: "chime", amount: { kind: "eventAmount" } },
        ],
      },
    ]);
  });
});
