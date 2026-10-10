/**
 * docs/phase7-wave9.md §3.5 and §3.19: `resetHitPoints` with a printed number ("reset his hit points to 10 instead",
 * owner decision Q3 = A) and `attachCard` with `as: "captive"` ("Attached ally is under no player's control").
 */

import { describe, expect, it } from "vitest";
import {
  attachCard,
  chooseTarget,
  chosen,
  firstPlayer,
  forcedInterrupt,
  instead,
  on,
  query,
  resetHitPoints,
  self,
  whenRevealed,
} from "./index.js";
import { validateDefinition } from "./validate.js";

describe("§3.5 reset to a printed number", () => {
  it("'reset his hit points to 10 instead' sets 10 and is flagged a reset", () => {
    const definition = forcedInterrupt(on.defeated("self"), { would: true }, instead(resetHitPoints(self, { to: 10 })));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "replaceTriggeringEvent",
        with: [
          {
            kind: "setRemainingHitPoints",
            target: { kind: "self" },
            amount: { kind: "const", value: 10 },
            reset: true,
          },
        ],
      },
    ]);
  });

  it("without a number it is the maximum, unflagged (a dial at its maximum is a reset already)", () => {
    expect(resetHitPoints(self)).toEqual({
      kind: "setRemainingHitPoints",
      target: { kind: "self" },
      amount: { kind: "const", value: Number.MAX_SAFE_INTEGER },
    });
  });
});

describe("§3.19 an ally attached under no player's control", () => {
  it("'Attach 1 … ally faceup here. Attached ally is under no player's control.'", () => {
    const definition = whenRevealed(
      chooseTarget("hostage", query(["identity", "ally"]), { chooser: firstPlayer }),
      attachCard(chosen("hostage"), self, { as: "captive" }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[1]).toEqual({
      kind: "attach",
      card: { kind: "slot", slot: "hostage" },
      to: { kind: "self" },
      as: "captive",
    });
  });

  it("a captive ally is attached faceup: facedown with it is a validation problem", () => {
    const definition = whenRevealed(attachCard(self, self, { as: "captive", facedown: true }));
    expect(validateDefinition(definition).join("\n")).toMatch(/captive ally is attached faceup/);
  });
});
