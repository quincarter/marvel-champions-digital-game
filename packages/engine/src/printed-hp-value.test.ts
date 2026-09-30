/**
 * The `printedHp` `ValueSpec`: a character's printed hit points, "Play only if your identity has at least 14 printed hit
 * points" (Limitless Stamina, `spdr` 31023) and "equal to that ally's printed hit points" (Noble Sacrifice, `magneto`
 * 49018).
 *
 * Sources: RRG 1.8 "Printed" (p. 35), "Hit Points" (p. 22).
 */

import { describe, expect, it } from "vitest";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { resolveValue, type EffectContext } from "./select.js";
import type { ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { ALLY, giveCard, HERO, newGame, RESOURCE } from "./testing/scenario.js";

const p1 = playerId("p1");

const context = (bindings: Record<string, readonly InstanceId[]> = {}): EffectContext => ({
  selfInstanceId: null,
  controllerId: p1,
  event: null,
  bindings,
});

const printedHpOf = (state: GameState, id: InstanceId): number =>
  resolveValue(state, { kind: "printedHp", of: { kind: "slot", slot: "c" } } satisfies ValueSpec, context({ c: [id] }));

const yourIdentityHp = (state: GameState): number =>
  resolveValue(state, { kind: "printedHp", of: { kind: "identityOf", player: { kind: "controller" } } }, context());

function withForm(state: GameState, form: "hero" | "alterEgo"): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === p1 ? { ...p, identity: { ...p.identity, form, heroFormIndex: form === "hero" ? 0 : null } } : p,
    ),
  };
}

describe("ValueSpec printedHp (RRG 1.8 'Printed', p. 35)", () => {
  it("reads your identity's printed hit points in either form, ignoring damage on it", () => {
    const start = newGame();
    const identity = mustPlayer(start, p1).identity.instanceId;
    const damaged: GameState = {
      ...start,
      instances: { ...start.instances, [identity]: { ...mustInstance(start, identity), damage: 4 } },
    };
    expect(yourIdentityHp(withForm(damaged, "alterEgo"))).toBe(HERO.hp);
    expect(yourIdentityHp(withForm(damaged, "hero"))).toBe(HERO.hp);
    expect(HERO.hp).toBe(10);
  });

  it("reads a chosen ally's printed hit points wherever it is (here in hand)", () => {
    const given = giveCard(newGame(), p1, ALLY.id);
    expect(printedHpOf(given.state, given.id)).toBe(ALLY.hp);
    expect(ALLY.hp).toBe(3);
  });

  it("is 0 for a card that is not a character, and for an empty ref", () => {
    const given = giveCard(newGame(), p1, RESOURCE.id);
    expect(printedHpOf(given.state, given.id)).toBe(0);
    expect(resolveValue(given.state, { kind: "printedHp", of: { kind: "slot", slot: "none" } }, context())).toBe(0);
  });
});
