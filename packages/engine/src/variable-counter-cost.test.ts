/**
 * docs/phase7-wave3.md §3.32: "Remove up to N counters →" as a cost the player sizes (`spendCounters.upTo`, `bind`,
 * `costSelection.counters`). Synthetic cards shaped like "We Are Groot" (`gmw` 16006): "Hero Action: Remove up to 4
 * growth counters from Groot → choose that many friendly characters. Give each of those characters a tough status
 * card."
 *
 * Sources: RRG 1.8 "Cost" (p. 14): "A cost requiring 'any number' or 'up to' some number of game elements requires a
 * minimum of one such game element"; "Choose (Game Element)" (p. 12): "simultaneously choose as many as are
 * available, to a maximum of the specified number".
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command, CostSelection } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { ALLY, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;

const GROOT_ABILITY = stubAbility(
  "we-are.action",
  def({
    trigger: { kind: "action", form: "hero" },
    cost: { spendCounters: { counterType: "growth", amount: 4, target: "identity", upTo: true, bind: "x" } },
    effects: [
      {
        kind: "chooseTarget",
        slot: "friends",
        query: { categories: ["identity", "ally"] },
        chooser: { kind: "controller" },
        count: { kind: "var", name: "x" },
      },
      { kind: "giveStatus", target: { kind: "slot", slot: "friends" }, status: "tough" },
    ],
  }),
);
const WE_ARE = stubEvent({ id: "we-are", cost: 0, abilities: [GROOT_ABILITY.ref] });
const deps = depsOf(GROOT_ABILITY);

/** p1 in hero form with `growth` counters, an ally in play, and the event in hand. */
function start(growth: number): { state: GameState; card: InstanceId; ally: InstanceId } {
  const base = gameAtFirstTurn({ cards: [WE_ARE], deps, deck: [WE_ARE.id] });
  const ally = playerCardIntoPlay(base, ALLY.id);
  const identity = mustPlayer(ally.state, P1).identity.instanceId;
  const hero: GameState = {
    ...ally.state,
    players: ally.state.players.map((p) =>
      p.playerId === P1 ? { ...p, identity: { ...p.identity, form: "hero" } } : p,
    ),
    instances: {
      ...ally.state.instances,
      [identity]: { ...mustInstance(ally.state, identity), counters: growth > 0 ? { growth } : {} },
    },
  };
  const card = giveCard(hero, P1, WE_ARE.id);
  return { state: card.state, card: card.id, ally: ally.id };
}
const play = (card: InstanceId, costSelection?: CostSelection): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
  ...(costSelection ? { costSelection } : {}),
});
const identityOf = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const growthOn = (state: GameState): number => mustInstance(state, identityOf(state)).counters.growth ?? 0;
const tough = (state: GameState, id: InstanceId): number => mustInstance(state, id).statuses.tough;

describe("§3.32 'Remove up to 4 growth counters from Groot → choose that many friendly characters'", () => {
  it("removes the number chosen and binds it: 1 counter, 1 character", () => {
    const { state, card, ally } = start(3);
    const { session } = driveSession(startSession(state), deps, [play(card, { counters: 1 })]);
    expect(growthOn(session.state)).toBe(2);
    expect(tough(session.state, identityOf(session.state)) + tough(session.state, ally)).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("with no choice removes as many as it can, and chooses as many characters as there are (RRG 1.8 p. 12)", () => {
    const { state, card, ally } = start(3);
    const { session } = driveSession(startSession(state), deps, [play(card)]);
    expect(growthOn(session.state)).toBe(0);
    expect(tough(session.state, identityOf(session.state))).toBe(1);
    expect(tough(session.state, ally)).toBe(1);
  });

  it("refuses 0 (RRG 1.8 'Cost', p. 14), more than printed, and more than the card holds", () => {
    const { state, card } = start(3);
    for (const counters of [0, 5, 4]) {
      const result = applyCommand(state, play(card, { counters }), deps);
      expect(result.ok, `counters: ${counters}`).toBe(false);
    }
  });

  it("cannot be initiated with no counters, and legalActions reports the range it can be paid with", () => {
    const empty = start(0);
    expect(applyCommand(empty.state, play(empty.card), deps).ok).toBe(false);
    const three = start(3);
    const actions = legalActions(three.state, P1, deps);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    const offered = actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === three.card);
    expect(offered?.costCounters).toEqual({ min: 1, max: 3 });
    expect(actions.illegal.some((a) => a.action.kind === "playCard" && a.action.instanceId === three.card)).toBe(false);
  });
});
