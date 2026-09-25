/**
 * docs/phase7-wave4.md §3.25: "Discard an upgrade you control →" as a cost (`AbilityCost.discardCards`). Synthetic cards
 * shaped like Noble Sacrifice (`magneto` 49018: "Hero Action: Discard an ally you control → heal damage from your hero
 * equal to that ally's printed hit points …") and Lethal Weapon (`nebu` 22030: "Hero Action: Discard an upgrade you
 * control → discard this attachment.").
 *
 * Sources: the cards' own text; RRG 1.8 "Cost" (p. 13–14: costs are paid with cards the player controls, in full),
 * "Initiating Abilities" (p. 24, steps 3 and 5).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const GEAR = stubUpgrade({ id: "gear", cost: 0 });
const SACRIFICE_ACTION = stubAbility("sacrifice.action", {
  trigger: { kind: "action" },
  cost: { discardCards: { slot: "discarded", query: { categories: ["upgrade"] }, min: 1, max: 1 } },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 2 } }],
});
const SACRIFICE = stubEvent({ id: "sacrifice", cost: 0, abilities: [SACRIFICE_ACTION.ref] });
const deps: EngineDeps = depsOf(SACRIFICE_ACTION);

function start(gear: number): { state: GameState; gear: readonly InstanceId[]; card: InstanceId } {
  let state = gameAtFirstTurn({
    cards: [GEAR, SACRIFICE],
    deps,
    deck: [...copiesOf(GEAR.id, 3), SACRIFICE.id, ...copiesOf(SACRIFICE.id, 4)],
  });
  const ids: InstanceId[] = [];
  for (let i = 0; i < gear; i++) {
    const placed = playerCardIntoPlay(state, GEAR.id);
    state = placed.state;
    ids.push(placed.id);
  }
  const given = giveCard(state, P1, SACRIFICE.id);
  return { state: given.state, gear: ids, card: given.id };
}
const play = (card: InstanceId, costChoices?: CostChoices): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
  ...(costChoices ? { costChoices } : {}),
});
const offered = (state: GameState, card: InstanceId): boolean => {
  const actions = legalActions(state, P1, deps);
  return actions.kind === "turn" && actions.legal.some((a) => JSON.stringify(a.action).includes(`"${card}"`));
};

describe("§3.25 discarding cards in play as a cost", () => {
  it("the only matching card is discarded to pay, then the effect resolves", () => {
    const { state, gear, card } = start(1);
    const hand = mustPlayer(state, P1).hand.length;
    const { session } = driveSession(startSession(state), deps, [play(card)]);
    expect(mustPlayer(session.state, P1).discard).toContain(gear[0]);
    expect(mustPlayer(session.state, P1).hand.length).toBe(hand - 1 + 2);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("with no card to discard the cost can't be paid, so the card isn't offered and can't be played", () => {
    const { state, card } = start(0);
    expect(offered(state, card)).toBe(false);
    expect(applyCommand(state, play(card), deps).ok).toBe(false);
  });

  it("with a choice, the player names the card; the other stays in play", () => {
    const { state, gear, card } = start(2);
    expect(applyCommand(state, play(card), deps).ok).toBe(false);
    const { session } = driveSession(startSession(state), deps, [play(card, { discarded: [gear[1]!] })]);
    expect(mustPlayer(session.state, P1).discard).toContain(gear[1]);
    expect(mustInstance(session.state, gear[0]!)).toBeDefined();
    expect(mustPlayer(session.state, P1).playArea).toContain(gear[0]);
  });
});
