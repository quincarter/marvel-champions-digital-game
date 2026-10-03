/**
 * docs/phase7-wave6.md §3.5: "After a status card is discarded from X" (`statusDiscarded`). `on.statusDiscarded` emits
 * the pattern the engine matches (`status-discarded.test.ts` drives it): one event per status card, several discarded
 * at once in one shared response window (§4.1 Q5).
 */

import { describe, expect, it } from "vitest";
import { exhaustThis, on, response } from "./abilities.js";
import { draw, giveStatus } from "./effects.js";
import { yourIdentity } from "./values.js";
import { validateDefinition } from "./validate.js";

const colossus = { categories: ["identity"], controller: "you" } as const;

describe("§3.5 `on.statusDiscarded`", () => {
  it("Iron Will's shape: after a tough status card is discarded from Colossus, draw 1 card", () => {
    const definition = response(on.statusDiscarded("tough", colossus), draw(1));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "response",
      forced: false,
      on: { on: "statusDiscarded", eventIs: { status: "tough" }, targetIs: colossus },
    });
  });

  it("Organic Steel's shape exhausts itself, and the narrower forms: any card, this card", () => {
    const definition = response(
      on.statusDiscarded("tough", colossus),
      { cost: exhaustThis },
      giveStatus(yourIdentity, "tough"),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.cost).toEqual({ exhaustSelf: true });
    expect(on.statusDiscarded("stunned")).toEqual({ on: "statusDiscarded", eventIs: { status: "stunned" } });
    expect(on.statusDiscarded("confused", "self")).toEqual({
      on: "statusDiscarded",
      eventIs: { status: "confused" },
      selfIs: "target",
    });
  });
});
