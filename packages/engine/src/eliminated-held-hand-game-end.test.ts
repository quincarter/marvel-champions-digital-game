/**
 * RRG 1.8 "Player Elimination" (p. 34) step 5 with a hand card an ability still resolving has chosen (#816 review). An
 * elimination partway through that ability leaves the chosen card in hand while another player remains, and it goes
 * to the discard pile once nothing is resolving (`discardEliminatedHands`). When the game ends before that ability
 * drains (the last player eliminated, the villain defeated), nothing more resolves: `endGame` sweeps the held card
 * before `gameEnded`, and no card moves are logged after it. Synthetic cards shaped like Wolverine's Claws (35002).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;

/**
 * "Choose an event in your hand and take damage equal to its printed cost → [first], then play that event, ignoring its
 * resource cost." The cost eliminates P1 with the event held; `first` ends the game before the event is played.
 */
const heldAction = (id: string, first: EffectSpec) =>
  stubAbility(id, {
    trigger: { kind: "action" },
    cost: {
      exhaustSelf: true,
      chooseCard: { slot: "event", from: { zone: "hand", player: "you", query: { categories: ["event"] } } },
      damageSelf: { kind: "printedCost", of: { kind: "slot", slot: "event" } },
    },
    effects: [
      first,
      { kind: "playFromHand", player: { kind: "controller" }, ignoreCost: true, card: { kind: "slot", slot: "event" } },
    ],
  });
/** "Deal 50 damage to each identity": eliminates P2, the last player left. */
const DOOM_ACTION = heldAction("doom.action", {
  kind: "dealDamage",
  target: { kind: "each", query: { categories: ["identity"] } },
  amount: n(50),
});
/** "Deal 99 damage to the villain": defeats its only stage, and the players win. */
const SMITE_ACTION = heldAction("smite.action", { kind: "dealDamage", target: { kind: "villain" }, amount: n(99) });
const DOOM = stubUpgrade({ id: "doom", cost: 0, abilities: [DOOM_ACTION.ref] });
const SMITE = stubUpgrade({ id: "smite", cost: 0, abilities: [SMITE_ACTION.ref] });
const STRIKE_ACTION = stubAbility("held-strike.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(3) }],
});
const STRIKE = stubEvent({ id: "held-strike", cost: 2, abilities: [STRIKE_ACTION.ref] });
const VILLAIN = stubVillain({ id: "held-villain", stages: [{ hp: flat(60), atk: 1, sch: 0 }] });
const deps: EngineDeps = depsOf(DOOM_ACTION, SMITE_ACTION, STRIKE_ACTION);

/** P1 with `upgrade` in play and the strike in hand, at 8 damage of 10: the strike's printed cost (2) defeats them. */
function table(upgrade: typeof DOOM): { state: GameState; source: InstanceId; strike: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [DOOM, SMITE, STRIKE, VILLAIN],
    deps,
    villain: VILLAIN,
    players: 2,
    deck: [upgrade.id, STRIKE.id],
  });
  const withSource = playerCardIntoPlay(base, upgrade.id);
  const given = giveCard(withSource.state, P1, STRIKE.id);
  const identity = mustPlayer(given.state, P1).identity.instanceId;
  const state: GameState = {
    ...given.state,
    instances: { ...given.state.instances, [identity]: { ...given.state.instances[identity]!, damage: 8 } },
  };
  return { state, source: withSource.id, strike: given.id };
}

function use(upgrade: typeof DOOM, ability: typeof DOOM_ACTION) {
  const { state, source, strike } = table(upgrade);
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: source,
    abilityId: ability.ref.id,
    payment: [],
    costChoices: { event: [strike] },
  };
  const { session, events } = driveSession(startSession(state), deps, [command]);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { after: session.state, events, strike };
}

/** The held event went to P1's discard pile after P1's elimination and before `gameEnded`; no move came after it. */
function expectSweptBeforeGameEnded(after: GameState, events: readonly GameEvent[], strike: InstanceId): void {
  expect(mustPlayer(after, P1).hand).toEqual([]);
  expect(mustPlayer(after, P1).discard).toContain(strike);
  expect(after.stack).toEqual([]);
  const ended = events.findIndex((e) => e.type === "gameEnded");
  expect(ended).toBeGreaterThan(-1);
  expect(events.slice(ended + 1).filter((e) => e.type === "cardMoved")).toEqual([]);
  const sweep = events.findIndex((e) => e.type === "cardMoved" && e.instanceId === strike);
  expect(sweep).toBeGreaterThan(events.findIndex((e) => e.type === "playerEliminated" && e.playerId === P1));
  expect(sweep).toBeLessThan(ended);
}

describe("the game ends while an ability holds an eliminated player's hand card (#816 review)", () => {
  it("the last player is eliminated: the held card is swept before gameEnded, unplayed", () => {
    const { after, events, strike } = use(DOOM, DOOM_ACTION);
    expect(mustPlayer(after, P1).eliminated).toBe(true);
    expect(mustPlayer(after, P2).eliminated).toBe(true);
    expect(after.outcome).toMatchObject({ result: "loss", reason: "allPlayersDefeated" });
    expect(events.findIndex((e) => e.type === "playerEliminated" && e.playerId === P1)).toBeLessThan(
      events.findIndex((e) => e.type === "playerEliminated" && e.playerId === P2),
    );
    expect(mustPlayer(after, P2).hand).toEqual([]);
    expectSweptBeforeGameEnded(after, events, strike);
  });

  it("the villain is defeated: the held card is swept before gameEnded, unplayed", () => {
    const { after, events, strike } = use(SMITE, SMITE_ACTION);
    expect(mustPlayer(after, P1).eliminated).toBe(true);
    expect(mustPlayer(after, P2).eliminated).toBe(false);
    expect(after.outcome).toMatchObject({ result: "win" });
    // The event never resolved: its 3 damage would have come after the game ended.
    expect(events.some((e) => e.type === "cardPlayed" && e.instanceId === strike)).toBe(false);
    expectSweptBeforeGameEnded(after, events, strike);
  });
});
