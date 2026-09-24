/**
 * docs/phase7-wave3.md §3.21: naming a card type (composed from `chooseOne` and `refMatches { anywhere }`) and
 * `EffectSpec cancelConsequentialDamage`. Synthetic cards shaped like Cosmo (`stld` 17020, errata RRG 1.8 p. 67):
 * "Interrupt: When Cosmo attacks or thwarts, name a card type, then discard the top card of a player deck or the
 * encounter deck. If that card is of the named type, Cosmo does not take consequential damage for this use."
 *
 * Sources: RRG 1.8 "Consequential Damage" (p. 13), "Interrupt" (p. 24).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly } from "./testing/fixtures.js";
import { defaultPick, RESOURCE, UPGRADE } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const discardedIs = (categories: readonly ("resource" | "upgrade")[]): Predicate => ({
  kind: "refMatches",
  ref: { kind: "slot", slot: "discarded" },
  query: { categories },
  anywhere: true,
});
/** One branch per named type: discard the top card of your deck, and if it is that type, no consequential damage. */
const nameAndDiscard = (label: string, categories: readonly ("resource" | "upgrade")[]) => ({
  label,
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "zone", zone: "deck", player: { kind: "controller" }, top: { kind: "const", value: 1 } },
      to: "discard",
      bind: "discarded",
    },
    { kind: "if", condition: discardedIs(categories), then: [{ kind: "cancelConsequentialDamage", character: self }] },
  ] satisfies readonly EffectSpec[],
});
const COSMO_INTERRUPT = stubAbility("cosmo.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "attack", selfIs: "source" } },
  effects: [
    {
      kind: "chooseOne",
      chooser: { kind: "controller" },
      options: [nameAndDiscard("Resource", ["resource"]), nameAndDiscard("Upgrade", ["upgrade"])],
    },
  ],
});
const COSMO = stubAlly({ id: "cosmo", cost: 2, atk: 1, thw: 1, hp: 3, abilities: [COSMO_INTERRUPT.ref] });

const deps: EngineDeps = depsOf(COSMO_INTERRUPT);

/** Cosmo in play; the top of p1's deck is `top` (surgery). */
function start(top: CardId): { state: GameState; cosmo: InstanceId } {
  const base = gameAtFirstTurn({ cards: [COSMO], deps, deck: [COSMO.id] });
  const placed = playerCardIntoPlay(base, COSMO.id);
  const player = mustPlayer(placed.state, P1);
  const topId = player.deck.find((id) => placed.state.instances[id]?.cardId === top)!;
  return {
    cosmo: placed.id,
    state: {
      ...placed.state,
      players: placed.state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [topId, ...player.deck.filter((id) => id !== topId)] } : p,
      ),
    },
  };
}

/** Cosmo attacks the villain; the interrupt is taken and "Resource" named. */
function attack(state: GameState, cosmo: InstanceId) {
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") return choice.options.slice(0, 1).map((o) => o.optionId);
    if (choice?.prompt.kind === "chooseOption") return choice.options.slice(0, 1).map((o) => o.optionId);
    return defaultPick(current);
  };
  return driveSession(
    startSession(state),
    deps,
    [{ type: "basicAttack", playerId: P1, attackerInstanceId: cosmo, targetInstanceId: state.villains[0]!.instanceId }],
    pick,
  );
}

describe("§3.21 naming a card type, and 'does not take consequential damage for this use'", () => {
  it("when the discarded card is of the named type, the ally takes no consequential damage", () => {
    const { state, cosmo } = start(RESOURCE.id);
    const { session } = attack(state, cosmo);
    expect(mustInstance(session.state, cosmo).damage).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("when it is not, the ally takes its consequential damage as usual", () => {
    const { state, cosmo } = start(UPGRADE.id);
    const { session } = attack(state, cosmo);
    expect(mustInstance(session.state, cosmo).damage).toBe(1);
  });
});
