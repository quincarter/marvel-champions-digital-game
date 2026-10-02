/**
 * docs/phase7-wave6.md §3.41: "take N damage" is not damage the card deals for a card-effect bonus. Ruling, Jul 9, 2026
 * (3) #4: "Aggressive Energy increases damage dealt to enemies, not to Wolverine" (§4.1 Q21, generalized to every
 * `modifyCardEffect` damage bonus). Synthetic cards shaped like Berserker Barrage (35008) and Aggressive Energy
 * (`mut_gen` 32047).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const YOUR_IDENTITY = { kind: "identityOf", player: { kind: "controller" } } as const;

/** "Deal 3 damage to the villain. You take 1 damage." */
const barrage = stubAbility("barrage.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "dealDamage", target: { kind: "each", query: { categories: ["villain"] } }, amount: n(3) },
    { kind: "dealDamage", target: YOUR_IDENTITY, amount: n(1), taken: true },
  ],
});
/** The same without `taken`: damage the card deals to your own identity still takes the bonus. */
const scorch = stubAbility("scorch.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: YOUR_IDENTITY, amount: n(1) }],
});
/** "When you play an event, increase the amount of damage it deals by 1" (a standing Aggressive Energy). */
const energy = stubAbility("energy.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
  },
  effects: [{ kind: "modifyCardEffect", card: { kind: "eventTarget" }, damage: n(1) }],
});
const BARRAGE = stubEvent({ id: "barrage", cost: 0, abilities: [barrage.ref] });
const SCORCH = stubEvent({ id: "scorch", cost: 0, abilities: [scorch.ref] });
const ENERGY = stubSupport({ id: "energy", cost: 0, abilities: [energy.ref] });

const deps: EngineDeps = depsOf(barrage, scorch, energy);

function table(bonus: boolean): GameState {
  const state = gameAtFirstTurn({
    cards: [BARRAGE, SCORCH, ENERGY],
    deps,
    deck: [BARRAGE.id, SCORCH.id, ENERGY.id],
  });
  return bonus ? playerCardIntoPlay(state, ENERGY.id).state : state;
}

function play(state: GameState, card: string) {
  const given = giveCard(state, P1, card);
  const run = runCommands(given.state, deps, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  return { ...run, played: given.id };
}

const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;

describe("§3.41 'take N damage' gets no card damage bonus (Q21)", () => {
  it("with the bonus: the enemy takes 3 + 1, you take only 1, still from the event", () => {
    const start = table(true);
    const villain = activeVillain(start)!.instanceId;
    const identity = identityOf(start);
    const before = damageOn(start, identity);
    const { state, events, played } = play(start, BARRAGE.id);
    expect(damageOn(state, villain)).toBe(4);
    expect(damageOn(state, identity) - before).toBe(1);
    // Still damage from that card for every other purpose.
    expect(
      events.some(
        (e) =>
          e.type === "triggerEvent" &&
          e.event.kind === "dealDamage" &&
          e.event.targetInstanceId === identity &&
          e.event.sourceInstanceId === played,
      ),
    ).toBe(true);
  });

  it("without the bonus: 3 and 1", () => {
    const start = table(false);
    const villain = activeVillain(start)!.instanceId;
    const identity = identityOf(start);
    const before = damageOn(start, identity);
    const { state } = play(start, BARRAGE.id);
    expect(damageOn(state, villain)).toBe(3);
    expect(damageOn(state, identity) - before).toBe(1);
  });

  it("damage the card deals to your identity (not 'you take') still takes the bonus", () => {
    const start = table(true);
    const identity = identityOf(start);
    const before = damageOn(start, identity);
    const { state } = play(start, SCORCH.id);
    expect(damageOn(state, identity) - before).toBe(2);
  });
});
