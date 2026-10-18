/**
 * Hero-pack spec H3.16: a card searched for in the deck and played "as if it were in your hand" (`EffectSpec
 * playFromHand.from { deck: "search", asIfInHand: true }`). Synthetic cards shaped like Calling in Favors (`jj` 61008:
 * "Alter-Ego Action: Remove 2 evidence counters from Alias Investigations and exhaust Calling in Favors → search your
 * deck for an ally and play it as if it were in your hand, reducing its resource cost by 2. (Shuffle.)") and Squirrel
 * Girl (`jj` 61017: "Response: After you play Squirrel Girl from your hand, place 1 squirrel counter here for each card
 * in your hand (to a maximum of 4).").
 *
 * Sources: owner answer Q102 = A (2026-10-18), by analogy with RRG 1.8 FAQ "Magik (#30A)" (p. 64: a card played that
 * way "is considered to have been played from her hand"); RRG 1.8 "Search" (p. 39): the deck is shuffled once the step
 * completes.
 */

import type { AbilityId, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const playAlly = (from: NonNullable<Extract<EffectSpec, { kind: "playFromHand" }>["from"]>): EffectSpec => ({
  kind: "playFromHand",
  player: { kind: "controller" },
  from,
  costReduction: { kind: "const", value: 2 },
  filter: { categories: ["ally"] },
});
const FAVORS_ACTION = stubAbility(
  "favors.action",
  def({
    trigger: { kind: "action" },
    cost: { exhaustSelf: true },
    effects: [playAlly({ deck: "search", asIfInHand: true })],
  }),
);
// Control: the same search without "as if it were in your hand" (Shuri's Inventor's shape).
const PLAIN_ACTION = stubAbility(
  "plain.action",
  def({ trigger: { kind: "action" }, cost: { exhaustSelf: true }, effects: [playAlly("deck")] }),
);
const SQUIRREL_RESPONSE = stubAbility(
  "squirrel.response",
  def({
    trigger: { kind: "response", forced: false, on: { on: "cardPlayed", selfIs: "target", playedFromHand: true } },
    effects: [
      {
        kind: "addCounters",
        target: { kind: "self" },
        counterType: "squirrel",
        amount: {
          kind: "min",
          values: [
            { kind: "handCount", player: { kind: "controller" } },
            { kind: "const", value: 4 },
          ],
        },
      },
    ],
  }),
);
const FAVORS = stubSupport({ id: "favors", cost: 0, abilities: [FAVORS_ACTION.ref] });
const PLAIN = stubSupport({ id: "plain", cost: 0, abilities: [PLAIN_ACTION.ref] });
const SQUIRREL = stubAlly({ id: "squirrel", cost: 2, atk: 1, thw: 1, hp: 3, abilities: [SQUIRREL_RESPONSE.ref] });
const FILLER = stubEvent({ id: "filler", cost: 0, resources: 1 });
const deps: EngineDeps = depsOf(FAVORS_ACTION, PLAIN_ACTION, SQUIRREL_RESPONSE);

/** p1 with Favors and Plain in play, Squirrel in the deck and 5 cards in hand. */
function start(): { readonly state: GameState; readonly favors: InstanceId; readonly plain: InstanceId } {
  const deck: readonly CardId[] = [FAVORS.id, PLAIN.id, SQUIRREL.id, ...copiesOf(FILLER.id, 12)];
  const base = gameAtFirstTurn({ cards: [FAVORS, PLAIN, SQUIRREL, FILLER], deps, deck });
  const favors = playerCardIntoPlay(base, FAVORS.id);
  const plain = playerCardIntoPlay(favors.state, PLAIN.id);
  const owner = mustPlayer(plain.state, P1);
  const all = [...owner.hand, ...owner.deck];
  const fillers = all.filter((id) => mustInstance(plain.state, id).cardId === FILLER.id);
  const hand = fillers.slice(0, 5);
  const state: GameState = {
    ...plain.state,
    players: plain.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand, deck: all.filter((id) => !hand.includes(id)) } : p,
    ),
  };
  return { state, favors: favors.id, plain: plain.id };
}

const use = (card: InstanceId, abilityId: AbilityId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId,
  payment: [],
});
/** Picks Squirrel from the search and takes every response offered. */
const pick = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "playFromHand") {
    const squirrel = choice.options.find((o) => mustInstance(state, o.optionId as InstanceId).cardId === SQUIRREL.id);
    return squirrel ? [squirrel.optionId] : [];
  }
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};
const run = (state: GameState, command: Command) => driveSession(startSession(state), deps, [command], pick);
const playedLog = (events: readonly GameEvent[]) => events.find((e) => e.type === "cardPlayed");
const squirrelIn = (state: GameState): InstanceId | undefined =>
  mustPlayer(state, P1).playArea.find((id) => mustInstance(state, id).cardId === SQUIRREL.id);

describe("H3.16 a deck search played 'as if it were in your hand' (Calling in Favors, Q102 = A)", () => {
  it("the ally is played for 0, logged from the deck counting as from the hand, and the deck is shuffled once", () => {
    const t = start();
    const { session, events } = run(t.state, use(t.favors, FAVORS_ACTION.ref.id));
    expect(playedLog(events)).toMatchObject({
      cardId: SQUIRREL.id,
      resourcesPaid: 0,
      from: "deck",
      countsAsFrom: "hand",
    });
    expect(squirrelIn(session.state)).toBeDefined();
    const shuffles = events.filter(
      (e) => e.type === "deckShuffled" && e.zone.kind === "deck" && e.zone.playerId === P1,
    );
    expect(shuffles).toHaveLength(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("Squirrel Girl's 'after you play her from your hand' response answers it: 4 counters with 5 cards in hand", () => {
    const t = start();
    const { session } = run(t.state, use(t.favors, FAVORS_ACTION.ref.id));
    const squirrel = squirrelIn(session.state)!;
    expect(mustInstance(session.state, squirrel).counters.squirrel).toBe(4);
  });

  it("control: Squirrel played from the real hand answers it (2 fillers paid, 3 left: 3 counters)", () => {
    const t = start();
    const owner = mustPlayer(t.state, P1);
    const squirrel = owner.deck.find((id) => mustInstance(t.state, id).cardId === SQUIRREL.id)!;
    const state: GameState = {
      ...t.state,
      players: t.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: [...p.hand, squirrel], deck: p.deck.filter((id) => id !== squirrel) } : p,
      ),
    };
    const [a, b] = owner.hand;
    const { session, events } = run(state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: squirrel,
      payment: [{ fromHand: a! }, { fromHand: b! }],
      attachToInstanceId: null,
    });
    const logged = playedLog(events);
    expect(logged && "from" in logged).toBe(false);
    expect(mustInstance(session.state, squirrel).counters.squirrel).toBe(3);
  });

  it("control: the same search without 'as if in hand' is logged from the deck and is no play from the hand", () => {
    const t = start();
    const { session, events } = run(t.state, use(t.plain, PLAIN_ACTION.ref.id));
    const logged = playedLog(events);
    expect(logged).toMatchObject({ cardId: SQUIRREL.id, resourcesPaid: 0, from: "deck" });
    expect(logged && "countsAsFrom" in logged).toBe(false);
    // RRG 1.8 FAQ "Magik (#30A)" (p. 64): only a card played "as if it was in [the] hand" counts as played from it.
    expect(mustInstance(session.state, squirrelIn(session.state)!).counters.squirrel).toBeUndefined();
  });
});
