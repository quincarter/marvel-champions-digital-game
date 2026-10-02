/**
 * docs/phase7-wave6.md §3.2: "After you place a [type] counter" (`countersPlaced`). `on.countersPlaced` emits the pattern
 * the engine matches (`counters-placed.test.ts` drives it): once per placement, the number placed is `eventAmount`.
 */

import { describe, expect, it } from "vitest";
import { forcedResponse, on } from "./abilities.js";
import { addCounters, ifThen, removeCountersFrom } from "./effects.js";
import { countersOn, self, valueAtLeast } from "./values.js";
import { validateDefinition } from "./validate.js";

describe("§3.2 `on.countersPlaced`", () => {
  it("Asteroid M's shape: magnet counters placed on this scheme, at least 3 here, remove 3", () => {
    const definition = forcedResponse(
      on.countersPlaced("magnet", "self"),
      ifThen(valueAtLeast(countersOn(self, "magnet"), 3), removeCountersFrom(self, "magnet", 3)),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "response",
      forced: true,
      on: { on: "countersPlaced", eventIs: { counterType: "magnet" }, selfIs: "target" },
    });
  });

  it("Phoenix Force's shape and the narrower forms: any card, and only your own placements", () => {
    expect(forcedResponse(on.countersPlaced("power", "self"), addCounters("heard", 1)).trigger).toMatchObject({
      on: { on: "countersPlaced", eventIs: { counterType: "power" }, selfIs: "target" },
    });
    expect(on.countersPlaced("magnet")).toEqual({ on: "countersPlaced", eventIs: { counterType: "magnet" } });
    expect(on.countersPlaced("magnet", undefined, { by: "you" })).toEqual({
      on: "countersPlaced",
      eventIs: { counterType: "magnet" },
      playerIs: "controller",
    });
  });
});
