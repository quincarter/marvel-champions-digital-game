/**
 * docs/phase7-wave7.md §3.34: "Forced Response: After [the villain] is defeated or the last threat is removed from this
 * scheme, flip this card and reveal [its other face]." `on.lastThreatRemoved` reads the removal's own
 * `lastThreatRemoved` result, and `on.defeated`'s `villainStage` the stage number the defeat carries
 * (`permanent-side-scheme-defeat-protection.test.ts` in the engine drives both).
 */

import { describe, expect, it } from "vitest";
import { forcedResponse, on } from "./abilities.js";
import { flipCard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self } from "./values.js";

describe("§3.34 a permanent side scheme's two triggers", () => {
  it("'after the last threat is removed from this scheme' is a removal from it that left none", () => {
    expect(on.lastThreatRemoved("self")).toEqual({
      on: "removeThreat",
      selfIs: "target",
      requireResults: { lastThreatRemoved: 1 },
    });
    expect(on.lastThreatRemoved("host")).toEqual({
      on: "removeThreat",
      targetIs: { hostOfSelf: true },
      requireResults: { lastThreatRemoved: 1 },
    });
  });

  it("'after [villain] (II) is defeated' matches that stage number only; without it, any stage", () => {
    const villain = { categories: ["villain" as const] };
    expect(on.defeated(villain, { villainStage: 2 })).toEqual({
      on: "characterDefeated",
      targetIs: villain,
      eventAtLeast: { villainStageNumber: 2 },
      eventAtMost: { villainStageNumber: 2 },
    });
    expect(on.defeated(villain)).toEqual({ on: "characterDefeated", targetIs: villain });
  });

  it("both forced responses validate and flip the card to reveal its other face", () => {
    const emptied = forcedResponse(on.lastThreatRemoved("self"), flipCard(self, { reveal: true }));
    const defeated = forcedResponse(on.defeated({ categories: ["villain"] }), flipCard(self, { reveal: true }));
    expect(validateDefinition(emptied)).toEqual([]);
    expect(validateDefinition(defeated)).toEqual([]);
    expect(emptied.effects).toEqual([{ kind: "flipCard", target: self, reveal: true }]);
    expect(emptied.trigger).toMatchObject({ kind: "response", forced: true });
  });
});
