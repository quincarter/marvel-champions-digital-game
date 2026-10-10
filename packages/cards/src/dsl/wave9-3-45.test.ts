/**
 * docs/phase7-wave9.md §3.45: `on.aPlayerWouldBeDealtAnEncounterCard`, "Interrupt: When a player would be dealt an
 * encounter card, remove 1 recon counter from here instead." The engine's `encounter-card-being-dealt.test.ts` drives
 * the plain data.
 */

import { describe, expect, it } from "vitest";
import { forcedResponse, interrupt, on } from "./abilities.js";
import { instead, removeCountersFrom } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { countersOn, self, valueAtLeast } from "./values.js";

describe("§3.45 `on.aPlayerWouldBeDealtAnEncounterCard`", () => {
  it("names the event, any deal by default or the deals of the sources given", () => {
    expect(on.aPlayerWouldBeDealtAnEncounterCard()).toEqual({ on: "encounterCardBeingDealt" });
    expect(on.aPlayerWouldBeDealtAnEncounterCard("surge")).toEqual({
      on: "encounterCardBeingDealt",
      eventIs: { source: "surge" },
    });
    expect(on.aPlayerWouldBeDealtAnEncounterCard(["villainPhase", "hazard"])).toEqual({
      on: "encounterCardBeingDealt",
      eventIs: { source: ["villainPhase", "hazard"] },
    });
  });

  it("builds a `would` interrupt that replaces the deal while a counter is there", () => {
    const definition = interrupt(
      on.aPlayerWouldBeDealtAnEncounterCard(),
      { would: true, while: valueAtLeast(countersOn(self, "recon"), 1) },
      instead(removeCountersFrom(self, "recon", 1)),
    );
    expect(definition.trigger).toEqual({
      kind: "interrupt",
      forced: false,
      on: { on: "encounterCardBeingDealt" },
      while: {
        kind: "compare",
        left: { kind: "counters", of: { kind: "self" }, counterType: "recon" },
        op: "atLeast",
        right: { kind: "const", value: 1 },
      },
      would: true,
    });
    expect(definition.effects).toEqual([
      {
        kind: "replaceTriggeringEvent",
        with: [
          {
            kind: "removeCounters",
            target: { kind: "self" },
            counterType: "recon",
            amount: { kind: "const", value: 1 },
          },
        ],
      },
    ]);
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("validates: interrupt only, a deal about to happen has no response window", () => {
    const problems = validateDefinition(forcedResponse(on.aPlayerWouldBeDealtAnEncounterCard())).join("\n");
    expect(problems).toMatch(/encounterCardBeingDealt is interrupt-only/);
  });
});
