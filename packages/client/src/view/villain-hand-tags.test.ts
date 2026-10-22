import { describe, expect, it } from "vitest";
import type { AbilityId } from "@mc/content";
import type { AbilityTriggerSpec } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import type { InstanceId } from "@mc/engine";
import { handTriggersOf, sameHandTags, triggerTagKindOf, villainHandTagOf } from "./villain-hand-tags.js";

const triggerOf = (id: string): AbilityTriggerSpec => {
  const trigger = POOL_DEPS.abilities[id as AbilityId]?.trigger;
  if (!trigger) throw new Error(`no ability ${id}`);
  return trigger;
};

describe("villain hand tags: fresh draws", () => {
  it("sameHandTags tells a newly drawn card's tag from the same tag without it", () => {
    const tag = { kind: "turn" as const, text: "Your turn", ring: false };
    const id = "i1" as InstanceId;
    expect(sameHandTags(new Map([[id, tag]]), new Map([[id, { ...tag, text: "New · Your turn", fresh: true }]]))).toBe(
      false,
    );
    expect(sameHandTags(new Map([[id, tag]]), new Map([[id, { ...tag }]]))).toBe(true);
  });
});

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

describe("villain hand tags: cards that only answer from play", () => {
  it("an upgrade's response waits for the player's turn in hand; an event's is tagged by what it waits for", () => {
    const definition = (id: string) => POOL_DEPS.abilities[id as AbilityId];
    // Indomitable (01082), an upgrade: its Response is on the card in play, so in hand it is not WHEN HIT.
    const indomitable = handTriggersOf(false, [definition("01082.indomitable-response")]);
    expect(indomitable).toEqual([]);
    expect(villainHandTagOf(indomitable, false, false).kind).toBe("turn");
    // Backflip (01003), an event: played as its interrupt.
    const backflip = handTriggersOf(true, [definition("01003.backflip-interrupt")]);
    expect(villainHandTagOf(backflip, false, false).kind).toBe("hit");
  });
});
