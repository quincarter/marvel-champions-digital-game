/**
 * docs/phase7-wave4.md §3.30: a resource ability's own effects resolve when it is used in a payment. Synthetic cards
 * shaped like Gauntlet Gun (`warm` 23005: "Resource: Exhaust Gauntlet Gun → generate a [wild] resource for a War Machine
 * event and place 1 ammo counter on War Machine.") and Cybernetic Arm (`winter` 54002: "… That event deals 1 additional
 * damage.", which reads the card paid for).
 *
 * Sources: the cards' own text; RRG 1.8 "Resource Ability" (p. 37), "Initiating Abilities" (p. 24, steps 5–6: costs,
 * resources included, are paid before the card commences being played).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const GUN_RESOURCE = stubAbility("gun.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  effects: [{ kind: "addCounters", target: self, counterType: "ammo", amount: { kind: "const", value: 1 } }],
});
const GUN = stubSupport({ id: "gun", cost: 0, abilities: [GUN_RESOURCE.ref] });
/** Costs 1; draws a card for each ammo counter on the gun, so it shows whether the counter landed first. */
const BLAST_ACTION = stubAbility("blast.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "draw",
      player: { kind: "controller" },
      amount: { kind: "counters", of: { kind: "each", query: { name: "gun" } }, counterType: "ammo" },
    },
  ],
});
const BLAST = stubEvent({ id: "blast", cost: 1, resources: 1, abilities: [BLAST_ACTION.ref] });
const deps: EngineDeps = depsOf(GUN_RESOURCE, BLAST_ACTION);

function start(): { state: GameState; gun: InstanceId; blast: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [GUN, BLAST],
    deps,
    deck: [GUN.id, BLAST.id, ...copiesOf(BLAST.id, 6)],
  });
  const placed = playerCardIntoPlay(base, GUN.id);
  const given = giveCard(placed.state, P1, BLAST.id);
  return { state: given.state, gun: placed.id, blast: given.id };
}
const play = (blast: InstanceId, payment: Command & { type: "playCard" } extends { payment: infer P } ? P : never) =>
  ({ type: "playCard", playerId: P1, cardInstanceId: blast, payment, attachToInstanceId: null }) as Command;

describe("§3.30 a resource ability's own effects", () => {
  it("used to pay, its effect resolves with the payment, before the card paid for", () => {
    const { state, gun, blast } = start();
    const hand = mustPlayer(state, P1).hand.length;
    const { session } = driveSession(startSession(state), deps, [
      play(blast, [{ ability: { instanceId: gun, abilityId: GUN_RESOURCE.ref.id } }]),
    ]);
    expect(mustInstance(session.state, gun).counters["ammo"]).toBe(1);
    expect(mustInstance(session.state, gun).exhausted).toBe(true);
    // The Blast drew 1 card: the counter was already on the gun when it resolved (hand: −Blast +1).
    expect(mustPlayer(session.state, P1).hand.length).toBe(hand);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("not used, nothing happens: paying from hand leaves the gun ready and bare", () => {
    const { state, gun, blast } = start();
    const spare = mustPlayer(state, P1).hand.find((id) => id !== blast)!;
    const { session } = driveSession(startSession(state), deps, [play(blast, [{ fromHand: spare }])]);
    expect(mustInstance(session.state, gun).counters["ammo"] ?? 0).toBe(0);
    expect(mustInstance(session.state, gun).exhausted).toBe(false);
  });
});
