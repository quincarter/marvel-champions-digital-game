import { describe, expect, it } from "vitest";
import { instanceId, playerId } from "./ids.js";
import { evaluate } from "./select.js";
import type { GameState } from "./state.js";
import type { TriggerEvent } from "./trigger-events.js";

/**
 * `Predicate eventKindIs` (docs/phase7-wave11-scenarios.md §S7, E20): one ability heard on several event kinds
 * branches on the kind of its triggering event. It reads only the context's event, so an empty state is enough here.
 */
const STATE = {} as GameState;
const scheme = instanceId("scheme");
const placed: TriggerEvent = { kind: "placeThreat", schemeInstanceId: scheme, amount: 1, sourceInstanceId: null };
const removed: TriggerEvent = { kind: "removeThreat", schemeInstanceId: scheme, amount: 1, sourceInstanceId: null };
const context = (event: TriggerEvent | null) =>
  ({ selfInstanceId: null, controllerId: playerId("p1"), event, bindings: {} }) as const;

describe("eventKindIs", () => {
  it("matches the triggering event's kind, and not another", () => {
    expect(evaluate(STATE, { kind: "eventKindIs", event: "placeThreat" }, context(placed))).toBe(true);
    expect(evaluate(STATE, { kind: "eventKindIs", event: "placeThreat" }, context(removed))).toBe(false);
  });

  it("a list matches any one of its kinds", () => {
    const either = { kind: "eventKindIs", event: ["placeThreat", "removeThreat"] } as const;
    expect(evaluate(STATE, either, context(placed))).toBe(true);
    expect(evaluate(STATE, either, context(removed))).toBe(true);
    expect(evaluate(STATE, { kind: "eventKindIs", event: ["thwart"] }, context(removed))).toBe(false);
  });

  it("is false with no triggering event", () => {
    expect(evaluate(STATE, { kind: "eventKindIs", event: "placeThreat" }, context(null))).toBe(false);
  });
});
