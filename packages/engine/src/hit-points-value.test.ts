/**
 * `ValueSpec hitPoints`: a card's hit points, its modified maximum (`maxHitPoints`), whatever damage is on it — the
 * value "heal it to 1 remaining hit point" needs for an ally that is already damaged (Valkyrie 62014;
 * docs/phase7-wave11-hero-packs.md). Control: `remainingHp` on the same ally reads the damage taken off.
 *
 * Sources: RRG 1.8 "Hit Points" (p. 22): damage on a card reduces its remaining hit points, not its hit points.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { resolveValue } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

/** "Allies you control get +2 hit points." */
const BANNER_ABILITY = stubAbility("banner.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 2, target: { categories: ["ally"] } }] },
  effects: [],
} satisfies AbilityDefinition);
const BANNER = stubSupport({ id: "banner", cost: 0, abilities: [BANNER_ABILITY.ref] });
const SOLDIER = stubAlly({ id: "soldier", cost: 0, atk: 1, thw: 1, hp: 3 });
const deps = depsOf(BANNER_ABILITY);

function table(banner: boolean): { readonly state: GameState; readonly ally: InstanceId } {
  let state = gameAtFirstTurn({ cards: [BANNER, SOLDIER], deps, deck: [BANNER.id, SOLDIER.id] });
  if (banner) state = playerCardIntoPlay(state, BANNER.id).state;
  const ally = playerCardIntoPlay(state, SOLDIER.id);
  return {
    ally: ally.id,
    state: {
      ...ally.state,
      instances: { ...ally.state.instances, [ally.id]: { ...mustInstance(ally.state, ally.id), damage: 2 } },
    },
  };
}

const read = (state: GameState, kind: "hitPoints" | "remainingHp", id: InstanceId | null) =>
  resolveValue(
    state,
    { kind, of: id ? { kind: "self" } : { kind: "each", query: { name: "nobody" } } },
    { selfInstanceId: id, controllerId: P1, event: null, bindings: {}, deps },
    deps,
  );

describe("`ValueSpec hitPoints`", () => {
  it("is the printed maximum on a damaged ally; `remainingHp` (control) takes the damage off", () => {
    const { state, ally } = table(false);
    expect(read(state, "hitPoints", ally)).toBe(3);
    expect(read(state, "remainingHp", ally)).toBe(1);
  });

  it("includes hit point modifiers", () => {
    const { state, ally } = table(true);
    expect(read(state, "hitPoints", ally)).toBe(5);
    expect(read(state, "remainingHp", ally)).toBe(3);
  });

  it("reads 0 when the ref names no card", () => {
    const { state } = table(false);
    expect(read(state, "hitPoints", null)).toBe(0);
  });
});
