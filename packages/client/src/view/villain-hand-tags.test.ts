import { describe, expect, it } from "vitest";
import type { AbilityId } from "@mc/content";
import type { AbilityTriggerSpec } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { triggerTagKindOf, villainHandTagOf } from "./villain-hand-tags.js";

const triggerOf = (id: string): AbilityTriggerSpec => {
  const trigger = POOL_DEPS.abilities[id as AbilityId]?.trigger;
  if (!trigger) throw new Error(`no ability ${id}`);
  return trigger;
};

describe("villain hand tags", () => {
  it("reads what a real Core card's interrupt waits for off its trigger", () => {
    // Backflip: "When you would take any amount of damage from an attack".
    expect(triggerTagKindOf(triggerOf("01003.backflip-interrupt"))).toBe("hit");
    // Enhanced Spider-Sense: "When a treachery card is revealed from the encounter deck".
    expect(triggerTagKindOf(triggerOf("01004.enhanced-spider-sense-interrupt"))).toBe("treachery");
    // Great Responsibility: "When threat would be placed on a scheme".
    expect(triggerTagKindOf(triggerOf("01061.great-responsibility-interrupt"))).toBe("threat");
    // An action waits for the player's own turn; a forced interrupt is nobody's choice.
    expect(triggerTagKindOf(triggerOf("01005.swinging-web-kick-action"))).toBeNull();
    expect(triggerTagKindOf(triggerOf("01007.spider-tracer-forced-interrupt"))).toBeNull();
  });

  it("puts PLAY NOW, ringed, ahead of anything else, then the trigger, then resource or your turn", () => {
    const backflip = triggerOf("01003.backflip-interrupt");
    expect(villainHandTagOf([backflip], false, true)).toEqual({ kind: "now", text: "Play now", ring: true });
    expect(villainHandTagOf([backflip], false, false)).toEqual({ kind: "hit", text: "When hit", ring: false });
    expect(villainHandTagOf([], true, false).kind).toBe("resource");
    expect(villainHandTagOf([triggerOf("01005.swinging-web-kick-action")], false, false)).toEqual({
      kind: "turn",
      text: "Your turn",
      ring: false,
    });
  });
});
