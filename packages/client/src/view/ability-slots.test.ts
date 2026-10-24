import { describe, expect, it } from "vitest";
import type { InstanceId } from "@mc/engine";
import type { FocusTarget } from "./focus.js";
import { abilityInSlot, abilitySlotsOf } from "./ability-slots.js";

const card = (id: string): FocusTarget => ({ kind: "card", instanceId: id as InstanceId });
const ABILITIES: Record<string, readonly string[]> = { hero: ["hero-a"], ally: ["ally-a", "ally-b"], event: [] };

describe("abilitySlotsOf", () => {
  it("lists each card's usable abilities in route order and skips cards with none", () => {
    const route: FocusTarget[] = [card("event"), card("ally"), { kind: "basic", action: "attack" }, card("hero")];
    expect(abilitySlotsOf(route, (id) => ABILITIES[id] ?? [])).toEqual(["ally-a", "ally-b", "hero-a"]);
  });

  it("counts a card named twice once, and ignores non-card stops", () => {
    const route: FocusTarget[] = [card("hero"), card("hero"), { kind: "undo" }];
    expect(abilitySlotsOf(route, (id) => ABILITIES[id] ?? [])).toEqual(["hero-a"]);
  });
});

describe("abilityInSlot", () => {
  const slots = ["a", "b", "c", "d", "e"];
  it("reads a slot on a page of four, the pad's paging", () => {
    expect(abilityInSlot(slots, 0)).toBe("a");
    expect(abilityInSlot(slots, 3)).toBe("d");
    expect(abilityInSlot(slots, 0, 1)).toBe("e");
    expect(abilityInSlot(slots, 1, 1)).toBeUndefined();
  });
});
