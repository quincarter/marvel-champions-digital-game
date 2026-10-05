/**
 * docs/phase7-wave7.md §3.27: "After a status card is placed on X" (`statusPlaced`). `on.statusPlaced` emits the
 * pattern the engine matches (`status-placed.test.ts` drives it): one event per status card that lands, several placed
 * at once in one shared response window.
 */

import { describe, expect, it } from "vitest";
import { forcedResponse, on } from "./abilities.js";
import { placeThreat } from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.27 `on.statusPlaced`", () => {
  it("the villain's shape: after a status card is placed on this card, place 1 threat on the main scheme", () => {
    const definition = forcedResponse(on.statusPlaced("self"), placeThreat(1, { kind: "mainScheme" }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "response",
      forced: true,
      on: { on: "statusPlaced", selfIs: "target" },
    });
  });

  it("the narrower forms: any character, one status, a query, placed by you", () => {
    expect(on.statusPlaced()).toEqual({ on: "statusPlaced" });
    expect(on.statusPlaced("self", { status: "tough" })).toEqual({
      on: "statusPlaced",
      eventIs: { status: "tough" },
      selfIs: "target",
    });
    const enemy = { categories: ["villain", "minion"] } as const;
    expect(on.statusPlaced(enemy, { status: "stunned", by: "you" })).toEqual({
      on: "statusPlaced",
      eventIs: { status: "stunned" },
      targetIs: enemy,
      playerIs: "controller",
    });
  });
});
