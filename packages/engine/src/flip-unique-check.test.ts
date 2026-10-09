/**
 * The unique rule on a card that flips in place into a separately emitted face (`otherFaceId`): RRG 1.8 "Unique Icon"
 * (pp. 45-46), "A non-villain card in an out-of-play state that matches a card in play cannot enter play. If the
 * out-of-play card is: a player card, it cannot be played or put into play. Any effect that attempts to do so has no
 * effect. A non-villain encounter card, it is discarded and any effects of it entering play are ignored." Owner answers
 * Q39 and Q45 (docs/phase7-wave8.md §4.1): a scenario's "flip this card and put [the ally] into play" is no exception.
 *
 * Synthetic cards: a side scheme whose When Defeated flips it into a unique ally, and one that flips into a unique
 * minion, each with a card of the same title already in play or not.
 */

import type { AnyCard, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const FLIP = stubAbility("flip-over.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "flipCard", target: self }],
});
const faces = <A extends AnyCard, B extends AnyCard>(a: A, b: B): readonly [A, B] => [
  { ...a, otherFaceId: b.id as CardId },
  { ...b, otherFaceId: a.id as CardId },
];
const unique = <C extends AnyCard>(card: C, name: string): C => ({ ...card, name, unique: true });

const [RESCUE, RESCUED] = faces(
  stubSideScheme({ id: "rescue", startingThreat: 3, abilities: [FLIP.ref] }),
  unique(stubAlly({ id: "rescued-ally", cost: 0, atk: 1, thw: 1, hp: 3 }), "Sparks"),
);
const [AMBUSH, AMBUSHER] = faces(
  stubSideScheme({ id: "ambush", startingThreat: 3, abilities: [FLIP.ref] }),
  unique(stubMinion({ id: "ambusher", atk: 2, sch: 1, hp: 4 }), "Cinder"),
);
/** A player's own unique ally and a unique minion with the same titles as the two new faces. */
const SPARKS = unique(stubAlly({ id: "sparks", cost: 0, atk: 1, thw: 1, hp: 3 }), "Sparks");
const CINDER = unique(stubMinion({ id: "cinder", atk: 1, sch: 1, hp: 9 }), "Cinder");

const eachSideScheme: TargetRef = { kind: "each", query: { categories: ["sideScheme"] } };
const effects: readonly EffectSpec[] = [
  { kind: "removeThreat", target: eachSideScheme, amount: { kind: "const", value: 9 } },
];
const THWART_ABILITY = stubAbility("thwart.action", { trigger: { kind: "action" }, effects });
const THWART = stubEvent({ id: "thwart", cost: 0, abilities: [THWART_ABILITY.ref] });
const deps: EngineDeps = depsOf(FLIP, THWART_ABILITY);

const base = (): GameState =>
  gameAtFirstTurn({
    cards: [RESCUE, RESCUED, AMBUSH, AMBUSHER, SPARKS, CINDER, THWART],
    deps,
    encounter: [RESCUE.id, AMBUSH.id, CINDER.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [SPARKS.id, ...copiesOf(THWART.id, 2)],
  });

function defeat(
  state: GameState,
  scheme: AnyCard,
): {
  after: GameState;
  id: InstanceId;
  events: readonly GameEvent[];
  session: GameSession;
} {
  const placed = encounterCardInVillainArea(state, scheme.id, 2);
  const { state: after, events, session } = playFree(placed.state, deps, THWART.id);
  return { after, id: placed.id, events, session };
}
const blocked = (events: readonly GameEvent[]) => events.filter((e) => e.type === "uniqueEntryBlocked");
const types = (events: readonly GameEvent[]) => events.map((e) => e.type);

describe("RRG 1.8 'Unique Icon' (pp. 45-46): a flip into a unique face", () => {
  it("control: with no matching card in play the scheme flips into the ally, under the first player's control", () => {
    const { after, id, events } = defeat(base(), RESCUE);
    expect(mustInstance(after, id).cardId).toBe(RESCUED.id);
    expect(locateCard(after, id)).toEqual({ kind: "playArea", playerId: P1 });
    expect(blocked(events)).toEqual([]);
  });

  it("a player-card face that matches a card in play: the flip has no effect, and the defeated scheme leaves play", () => {
    const ally = playerCardIntoPlay(base(), SPARKS.id);
    const { after, id, events, session } = defeat(ally.state, RESCUE);
    expect(blocked(events)).toEqual([
      {
        type: "uniqueEntryBlocked",
        instanceId: id,
        cardId: RESCUED.id,
        matchedInstanceId: ally.id,
        disposition: "noEffect",
      },
    ]);
    // It never showed the new face, and nothing answers a flip that did not happen.
    expect(types(events)).not.toContain("cardFlippedToOtherFace");
    expect(types(events)).not.toContain("cardFlipped");
    expect(mustInstance(after, id).cardId).toBe(RESCUE.id);
    expect(cardsInPlay(after)).not.toContain(id);
    // RRG 1.8 "Double-Sided Card" (p. 17): leaving play by its defeat, it is removed from the game.
    expect(locateCard(after, id)).toEqual({ kind: "removedFromGame" });
    expect(cardsInPlay(after)).toContain(ally.id);
    expect(types(events)).toContain("schemeDefeated");
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after);
  });

  it("an encounter face that matches a card in play: the card is discarded, and no minion engages anyone", () => {
    const minion = minionEngagedWith(base(), CINDER.id);
    const { after, id, events } = defeat(minion.state, AMBUSH);
    expect(blocked(events)).toMatchObject([
      { cardId: AMBUSHER.id, matchedInstanceId: minion.id, disposition: "discarded" },
    ]);
    expect(types(events)).not.toContain("cardFlippedToOtherFace");
    expect(cardsInPlay(after)).not.toContain(id);
    expect(locateCard(after, id)).toEqual({ kind: "removedFromGame" });
    expect(types(events)).not.toContain("minionEngaged");
  });

  it("control: the same scheme with no Cinder in play flips into the minion, engaged with the first player", () => {
    const { after, id, events } = defeat(base(), AMBUSH);
    expect(mustInstance(after, id).cardId).toBe(AMBUSHER.id);
    expect(mustInstance(after, id).engagedWith).toBe(P1);
    expect(blocked(events)).toEqual([]);
  });

  it("the match is read by title: an unrelated unique card in play blocks nothing", () => {
    const minion = minionEngagedWith(base(), CINDER.id);
    const { after, id, events } = defeat(minion.state, RESCUE);
    expect(mustInstance(after, id).cardId).toBe(RESCUED.id);
    expect(blocked(events)).toEqual([]);
  });
});
