/**
 * docs/phase7-wave7.md §3.35: "If [a named card] is in play, attach to [one character]. Otherwise, attach to your
 * identity." `attachInstruction(...)` builds the card's attach instruction: a reveal-time ability flagged
 * `attachInstruction`, which the engine resolves at the reveal's attach step and never as a When Revealed
 * (`attach-instruction.test.ts` in the engine drives it).
 */

import { describe, expect, it } from "vitest";
import { attachInstruction, whenRevealed } from "./abilities.js";
import { attachCard, ifThen, placeThreat } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { inPlay, named, self, theMainScheme, yourIdentity } from "./values.js";

describe("§3.35 an attach host decided by a condition at reveal", () => {
  const instruction = attachInstruction(
    ifThen(inPlay("The Grasp"), attachCard(self, named("The Host")), attachCard(self, yourIdentity)),
  );

  it("compiles to a flagged reveal-time ability whose effects pick the host", () => {
    expect(instruction).toEqual({
      trigger: { kind: "whenRevealed" },
      attachInstruction: true,
      effects: [
        {
          kind: "if",
          condition: { kind: "exists", query: { name: "The Grasp" } },
          then: [{ kind: "attach", card: self, to: { kind: "named", name: "The Host" } }],
          otherwise: [{ kind: "attach", card: self, to: yourIdentity }],
        },
      ],
    });
    expect(validateDefinition(instruction)).toEqual([]);
  });

  it("a printed When Revealed attach stays an ordinary, cancelable whenRevealed", () => {
    expect(whenRevealed(attachCard(self, yourIdentity))).not.toHaveProperty("attachInstruction");
  });

  it("is rejected when it never attaches its own card", () => {
    expect(validateDefinition(attachInstruction(placeThreat(1, theMainScheme)))).toContain(
      "an attachInstruction ability must attach its own card (attachCard(self, …))",
    );
  });

  it("is rejected on any trigger but its reveal-time carrier, and with a cancel-proof flag", () => {
    const boostLike = { ...instruction, trigger: { kind: "boost" as const } };
    expect(validateDefinition(boostLike)).toContain("an attachInstruction ability is built on a whenRevealed trigger");
    expect(validateDefinition({ ...instruction, uncancellable: true as const })).toContain(
      "an attachInstruction ability has no cost, limit, label or uncancellable flag",
    );
  });
});
