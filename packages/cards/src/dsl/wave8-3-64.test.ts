/**
 * docs/phase7-wave8.md §3.64: the builders for a player making a basic attack or thwart on a card's instruction.
 * `basicPowerBy(player, powers, { bonus })` and `canUseBasicPower(powers, player)` emit the engine's plain specs
 * (`basic-power-by.test.ts` in the engine drives them).
 */

import { describe, expect, it } from "vitest";
import { action, exhaustThis, removeCounter } from "./abilities.js";
import { basicPowerBy, choosePlayer } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { canUseBasicPower, chosenPlayer, eachPlayer, playersWhere, thatPlayer, you } from "./values.js";

const POWERS = ["attack", "thwart"] as const;

describe("§3.64 `basicPowerBy`, `canUseBasicPower`", () => {
  it("Cell Phone's shape: gated on some player who can, that player chosen, the power made at +1 / +1", () => {
    const definition = action(
      { cost: [exhaustThis, removeCounter("charge", 1)], while: canUseBasicPower(POWERS, eachPlayer) },
      choosePlayer("player", you, { among: playersWhere(canUseBasicPower(POWERS, thatPlayer)) }),
      basicPowerBy(chosenPlayer("player"), POWERS, { bonus: { thw: 1, atk: 1 } }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "action",
      while: { kind: "canUseBasicPower", player: { kind: "each" }, powers: ["attack", "thwart"] },
    });
    expect(definition.effects).toEqual([
      {
        kind: "choosePlayer",
        slot: "player",
        chooser: { kind: "controller" },
        among: {
          kind: "where",
          predicate: { kind: "canUseBasicPower", player: { kind: "scoped" }, powers: ["attack", "thwart"] },
        },
      },
      {
        kind: "basicPowerBy",
        player: { kind: "slot", slot: "player" },
        powers: ["attack", "thwart"],
        bonus: { thw: 1, atk: 1 },
      },
    ]);
  });

  it("no bonus leaves the field out; the predicate defaults to you", () => {
    expect(basicPowerBy(you, ["attack"])).toEqual({
      kind: "basicPowerBy",
      player: { kind: "controller" },
      powers: ["attack"],
    });
    expect(canUseBasicPower(["thwart"])).toEqual({
      kind: "canUseBasicPower",
      player: { kind: "controller" },
      powers: ["thwart"],
    });
  });

  it("refuses an empty list of powers", () => {
    expect(() => basicPowerBy(you, [])).toThrow(/at least one power/);
  });
});
