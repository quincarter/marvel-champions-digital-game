/**
 * docs/phase7-wave3.md §3.20: a cost reduction the player opts into while playing a card (`AbilityDefinition.playCostReduction`,
 * `playCard.costReductionAbilities`) and a "deal yourself 1 facedown encounter card" cost (`AbilityCost.dealEncounterCards`).
 * Synthetic cards shaped like Star-Lord's "What could go wrong?" (`stld` 17001a): "Interrupt: When you play a card from
 * your hand, deal yourself 1 facedown encounter card → reduce the cost to play that card by 3. (Limit once per round.)"
 *
 * The printed timing is kept as the trigger (an Interrupt on `cardBeingPlayed`); `playCostReduction` makes the engine
 * use it at payment rather than in that window.
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24) steps 3–5, "Cost" (p. 13), "Deal" (p. 14); §4 Q6 for the timing.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { ALLY, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const WHAT_COULD_GO_WRONG: AbilityDefinition = {
  trigger: { kind: "interrupt", forced: false, on: { on: "cardBeingPlayed", playerIs: "controller" } },
  playCostReduction: { amount: 3, fromHand: true },
  cost: { dealEncounterCards: 1 },
  limit: { count: 1, period: "round" },
  effects: [],
};
const REDUCER_ABILITY = stubAbility("reducer.cost", WHAT_COULD_GO_WRONG);
const REDUCER = stubSupport({ id: "reducer", cost: 0, abilities: [REDUCER_ABILITY.ref] });

const deps: EngineDeps = depsOf(REDUCER_ABILITY);

/** p1's first turn with the reducer in play and two allies (cost 2) in hand; no resource cards in hand. */
function start(): { state: GameState; reducer: InstanceId; allies: readonly InstanceId[] } {
  const base = gameAtFirstTurn({ cards: [REDUCER], deps, deck: [REDUCER.id, ...copiesOf(ALLY.id, 2)] });
  const placed = playerCardIntoPlay(base, REDUCER.id);
  let state = placed.state;
  const allies: InstanceId[] = [];
  for (let i = 0; i < 2; i++) {
    const given = giveCard(state, P1, ALLY.id, allies);
    state = given.state;
    allies.push(given.id);
  }
  // Discard every other card in hand, so the reduction is the only way to pay.
  const player = mustPlayer(state, P1);
  state = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: player.hand.filter((id) => allies.includes(id)),
            discard: [...p.discard, ...player.hand.filter((id) => !allies.includes(id))],
          }
        : p,
    ),
  };
  return { state, reducer: placed.id, allies };
}

const play = (card: InstanceId, reducer?: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
  ...(reducer ? { costReductionAbilities: [{ instanceId: reducer, abilityId: REDUCER_ABILITY.ref.id }] } : {}),
});

describe("§3.20 'reduce the cost to play that card by 3'", () => {
  it("without it, a cost-2 ally cannot be paid for with nothing", () => {
    const { state, allies } = start();
    expect(applyCommand(state, play(allies[0]!), deps).ok).toBe(false);
  });

  it("with it, the ally costs 0, and its cost deals the player a facedown encounter card", () => {
    const { state, reducer, allies } = start();
    const { session, events } = driveSession(startSession(state), deps, [play(allies[0]!, reducer)]);
    expect(mustPlayer(session.state, P1).playArea).toContain(allies[0]);
    expect(mustPlayer(session.state, P1).dealtEncounter).toHaveLength(1);
    expect(events).toContainEqual(expect.objectContaining({ type: "playCostReduced", amount: 3 }));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("its limit holds: a second use in the same round is refused", () => {
    const { state, reducer, allies } = start();
    const { session } = driveSession(startSession(state), deps, [play(allies[0]!, reducer)]);
    const second = applyCommand(session.state, play(allies[1]!, reducer), deps);
    expect(second.ok).toBe(false);
  });

  it("the legal-move list offers the play, using the reduction, when nothing else pays for it", () => {
    const { state, allies } = start();
    const actions = legalActions(state, P1, deps);
    if (actions.kind !== "turn") throw new Error(`expected p1's turn, got ${actions.kind}`);
    const offer = actions.legal.find(
      (entry) => entry.action.kind === "playCard" && entry.action.instanceId === allies[0],
    );
    expect(offer?.example).toMatchObject({ costReductionAbilities: [{ abilityId: REDUCER_ABILITY.ref.id }] });
  });
});
