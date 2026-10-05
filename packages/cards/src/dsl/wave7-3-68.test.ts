/**
 * docs/phase7-wave7.md §3.68: "return that event to your hand after resolving its effects"
 * (`returnToHandAfterResolving`, a destination written on the event's play). The engine's
 * `after-resolving-to-hand.test.ts` drives the behavior.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { on, resource, response } from "./abilities.js";
import { returnToHandAfterResolving } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, eventTarget } from "./values.js";

describe("§3.68 a played event returned to hand after it resolves", () => {
  it("returnToHandAfterResolving names the event and the hand", () => {
    expect(returnToHandAfterResolving(eventTarget)).toEqual({
      kind: "afterResolving",
      card: { kind: "eventTarget" },
      to: "hand",
    });
  });

  it("the card's shape: a response, in any form, to spending this card to play an event with a trait", () => {
    const aerialEvent = { categories: ["event"], trait: trait("AERIAL") } as const;
    const definition = response(on.youSpendThis({ toPlay: aerialEvent }), returnToHandAfterResolving(eventTarget));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({
      kind: "response",
      forced: false,
      on: {
        on: "resourcesSpent",
        selfIs: "source",
        playerIs: "controller",
        targetIs: aerialEvent,
        eventIs: { purpose: "playCard" },
      },
    });
    expect(definition.trigger).not.toHaveProperty("form");
    expect(definition.cost).toBeUndefined();
    expect(definition.effects).toEqual([returnToHandAfterResolving(eventTarget)]);
  });

  it("in a resource ability's own effects the event is slot `paidFor`", () => {
    const definition = resource(1, {}, returnToHandAfterResolving(chosen("paidFor")));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      { kind: "afterResolving", card: { kind: "slot", slot: "paidFor" }, to: "hand" },
    ]);
  });
});
