/**
 * A status card is placed on a character in play and nowhere else (`canTakeStatus`, the one decision `giveStatus`, a
 * `giveStatus` cost and `TargetQuery.canTakeStatus` share). "Response: After this attack, stun that enemy" resolving
 * after the attack defeated the enemy gives nothing to the card now in a discard pile or the victory display, and logs
 * nothing, the same as a give to a character already at its capacity.
 *
 * Source: RRG 1.8 "Status Cards" (p. 41): "When a character is given a status card, take a status card of the
 * specified type from the pool and place it on that character."
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { canTakeStatus } from "./keywords.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMinion, stubSupport } from "./testing/fixtures.js";
import { ALLY, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;

/** "Forced Response: After you attack an enemy, stun that enemy." */
const STUN_ABILITY = stubAbility(
  "after-attack-stun.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller" } },
    effects: [{ kind: "giveStatus", target: { kind: "eventTarget" }, status: "stunned", bind: "given" }],
  }),
);
const STUNNER = stubSupport({ id: "after-attack-stun", cost: 0, abilities: [STUN_ABILITY.ref] });
/** "Action: Discard each ally you control." */
const DISMISS_ABILITY = stubAbility(
  "dismiss.action",
  def({
    trigger: { kind: "action" },
    effects: [
      { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["ally"], controller: "you" } } },
    ],
  }),
);
const DISMISS = stubSupport({ id: "dismiss", cost: 0, abilities: [DISMISS_ABILITY.ref] });
const WEAK = stubMinion({ id: "weak-minion", atk: 1, sch: 1, hp: 2, boostIcons: 0 });
const STURDY = stubMinion({ id: "sturdy-minion", atk: 1, sch: 1, hp: 5, boostIcons: 0 });
/** Victory 1: defeated, it goes to the victory display. */
const PRIZE = stubMinion({
  id: "prize-minion",
  atk: 1,
  sch: 1,
  hp: 2,
  boostIcons: 0,
  keywords: [{ name: "victory", value: 1 }],
});

const CARDS = [STUNNER, DISMISS, WEAK, STURDY, PRIZE];
const deps = depsOf(STUN_ABILITY, DISMISS_ABILITY);
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const statusesOf = (state: GameState, id: InstanceId) => mustInstance(state, id).statuses;
const NONE = { stunned: 0, confused: 0, tough: 0 };
const withStatuses = (state: GameState, id: InstanceId, statuses: typeof NONE): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), statuses } },
});

/** P1 in hero form (ATK 2) with the stunning support in play and `minion` engaged. */
function start(minion: { readonly id: CardId }, stunner = true): { state: GameState; minion: InstanceId } {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [STUNNER.id, DISMISS.id],
    encounter: [minion.id, ...copiesOf(TREACHERY.id, 30)],
  });
  if (stunner) state = playerCardIntoPlay(state, STUNNER.id).state;
  state = driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
  const engaged = minionEngagedWith(state, minion.id);
  return { state: engaged.state, minion: engaged.id };
}
/** The commands through a session, with the log replayed to the same state. */
function run(state: GameState, ...commands: readonly Command[]): { state: GameState; events: readonly GameEvent[] } {
  const driven = driveSession(startSession(state), deps, commands);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}
const attack = (state: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(state),
  targetInstanceId: target,
});
const given = (events: readonly GameEvent[]) => events.filter((e) => e.type === "statusGiven");

describe("a status card needs a character in play (RRG 1.8 Status Cards, p. 41)", () => {
  it("the attacked enemy survives: it is stunned (2 of 5 damage, 1 stunned status card)", () => {
    const { state, minion } = start(STURDY);
    const after = run(state, attack(state, minion));
    expect(mustInstance(after.state, minion).damage).toBe(2);
    expect(statusesOf(after.state, minion)).toEqual({ stunned: 1, confused: 0, tough: 0 });
    expect(given(after.events)).toEqual([{ type: "statusGiven", instanceId: minion, status: "stunned" }]);
  });

  it("the attack defeats the enemy: the card in the encounter discard pile is given nothing and nothing is logged", () => {
    const { state, minion } = start(WEAK);
    const after = run(state, attack(state, minion));
    expect(locateCard(after.state, minion)?.kind).toBe("encounterDiscard");
    expect(statusesOf(after.state, minion)).toEqual(NONE);
    expect(given(after.events)).toEqual([]);
    expect(after.state.pendingStatusPlaced ?? []).toEqual([]);
  });

  it("the refusal has no side effect: the game ends where it does with no stunning ability in play", () => {
    const withAbility = start(WEAK);
    const without = start(WEAK, false);
    const a = run(withAbility.state, attack(withAbility.state, withAbility.minion));
    const b = run(without.state, attack(without.state, without.minion));
    expect(a.state.instances[withAbility.minion]).toEqual(b.state.instances[without.minion]);
    expect(a.state.lastingEffects).toEqual(b.state.lastingEffects);
    expect(a.state.stack).toEqual(b.state.stack);
    expect(a.events.filter((e) => e.type.startsWith("status"))).toEqual([]);
  });

  it("an enemy defeated into the victory display is given nothing", () => {
    const { state, minion } = start(PRIZE);
    const after = run(state, attack(state, minion));
    expect(after.state.victoryDisplay).toContain(minion);
    expect(statusesOf(after.state, minion)).toEqual(NONE);
    expect(given(after.events)).toEqual([]);
  });

  it("`canTakeStatus` is true only of a character in play", () => {
    const { state, minion } = start(STURDY);
    const hero = identityOf(state);
    const inHand = mustPlayer(state, P1).hand[0]!;
    const inDeck = mustPlayer(state, P1).deck.find((id) => mustInstance(state, id).cardId === ALLY.id)!;
    const support = mustPlayer(state, P1).playArea.find((id) => mustInstance(state, id).cardId === STUNNER.id)!;
    for (const status of ["stunned", "confused", "tough"] as const) {
      expect(canTakeStatus(state, hero, status, deps)).toBe(true);
      expect(canTakeStatus(state, minion, status, deps)).toBe(true);
      expect(canTakeStatus(state, state.activeVillainId!, status, deps)).toBe(true);
      // Out of play: a card in hand, an ally in the deck. In play but not a character: a support, the main scheme.
      expect(canTakeStatus(state, inHand, status, deps)).toBe(false);
      expect(canTakeStatus(state, inDeck, status, deps)).toBe(false);
      expect(canTakeStatus(state, support, status, deps)).toBe(false);
      expect(canTakeStatus(state, state.mainScheme.instanceId, status, deps)).toBe(false);
    }
  });

  it("a card that leaves play loses its status cards: a stunned, confused, tough minion defeated; an ally discarded", () => {
    const { state, minion } = start(WEAK, false);
    // Tough would absorb the attack, so the minion carries stunned and confused only.
    const marked = withStatuses(state, minion, { stunned: 1, confused: 1, tough: 0 });
    const defeated = run(marked, attack(marked, minion));
    expect(locateCard(defeated.state, minion)?.kind).toBe("encounterDiscard");
    expect(statusesOf(defeated.state, minion)).toEqual(NONE);

    const ally = playerCardIntoPlay(state, ALLY.id);
    const dismiss = playerCardIntoPlay(ally.state, DISMISS.id);
    const tough = withStatuses(dismiss.state, ally.id, { stunned: 1, confused: 1, tough: 1 });
    const discarded = run(tough, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: dismiss.id,
      abilityId: DISMISS_ABILITY.ref.id,
      payment: [],
    });
    expect(locateCard(discarded.state, ally.id)?.kind).toBe("discard");
    expect(statusesOf(discarded.state, ally.id)).toEqual(NONE);
  });
});
