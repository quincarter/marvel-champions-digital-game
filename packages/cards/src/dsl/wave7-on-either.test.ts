/**
 * `on.either`: one ability answering either of two whole event patterns (`EventPattern.anyOf`; RRG 1.8 "Triggering
 * Condition", p. 45). "Forced Response: After Stryfe is defeated or the last threat is removed from this scheme"
 * (Stryfe's Grasp, `next_evol` 40168a). `event-pattern-any-of.test.ts` in the engine drives it.
 */

import { describe, expect, it } from "vitest";
import { forcedResponse, on } from "./abilities.js";
import { flipCard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self } from "./values.js";

const villain = { categories: ["villain" as const] };

describe("on.either", () => {
  it("lists every kind an alternative hears, once, and keeps each alternative whole", () => {
    expect(on.either(on.defeated(villain), on.lastThreatRemoved("self"))).toEqual({
      on: ["characterDefeated", "removeThreat"],
      anyOf: [
        { on: "characterDefeated", targetIs: villain },
        { on: "removeThreat", selfIs: "target", requireResults: { lastThreatRemoved: 1 } },
      ],
    });
    const twice = on.either(
      on.lastThreatRemoved("self"),
      on.lastThreatRemoved("host"),
      on.enemySchemesOrAttacks("host"),
    );
    expect(twice.on).toEqual(["removeThreat", "enemyScheme", "enemyAttack"]);
    expect(twice.anyOf).toHaveLength(3);
  });

  it("validates; an alternative hearing a kind the outer pattern does not list is reported", () => {
    const flip = flipCard(self, { reveal: true });
    expect(
      validateDefinition(forcedResponse(on.either(on.defeated(villain), on.lastThreatRemoved("self")), flip)),
    ).toEqual([]);
    const unlisted = forcedResponse({ on: "characterDefeated", anyOf: [on.lastThreatRemoved("self")] }, flip);
    expect(validateDefinition(unlisted)).toEqual([
      'an event pattern alternative hears removeThreat, which the pattern\'s own "on" does not list',
    ]);
  });
});
