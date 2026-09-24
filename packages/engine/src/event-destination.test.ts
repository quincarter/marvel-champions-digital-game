/**
 * docs/phase7-wave3.md §3.11: an event that its own ability moves out of the resolving area is not then discarded.
 * Synthetic cards shaped like Clobber and Impede ("If this is the first card you have played this round, return this card
 * to your hand.", `gam`) and The Market's Grand Strategy ("Remove this card from the game.", `gmw`).
 *
 * Sources: RRG 1.8 "Event" (p. 19), "Play" / "Initiating Abilities" (p. 24) step 7.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";
import { driveSession } from "./testing/drive.js";
import { startSession } from "./engine.js";

const self = { kind: "ref", ref: { kind: "self" } } as const;
const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const hit = { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 3 } } as const;
/** "Deal 3 damage to the villain. If this is the first card you have played this round, return this card to your hand." */
const CLOBBER = actionEvent("clobber", [
  hit,
  {
    kind: "if",
    condition: { kind: "playedThisRound", player: { kind: "controller" }, atMost: 1 },
    then: [{ kind: "moveCards", cards: self, to: "hand" }],
  },
]);
/** "… Remove this card from the game." */
const GRAND = actionEvent("grand", [hit, { kind: "moveCards", cards: self, to: "removedFromGame" }]);
const PLAIN = actionEvent("plain", [hit]);
const EVENTS = [CLOBBER, GRAND, PLAIN];

const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

/** Plays `before` (if any) and then `card`, both for 0, and returns the second card's instance. */
function playOne(card: string, before?: string) {
  let state = gameAtFirstTurn({
    cards: EVENTS.map((e) => e.card),
    deps,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
  const first = before ? giveCard(state, P1, before) : null;
  if (first) state = first.state;
  const given = giveCard(state, P1, card, first ? [first.id] : []);
  const play = (id: InstanceId): Command => ({
    type: "playCard",
    playerId: P1,
    cardInstanceId: id,
    payment: [],
    attachToInstanceId: null,
  });
  const { session, events } = driveSession(startSession(given.state), deps, [
    ...(first ? [play(first.id)] : []),
    play(given.id),
  ]);
  return { state: session.state, events, id: given.id };
}

describe("§3.11 an event its own ability moves is not discarded afterwards", () => {
  it("'return this card to your hand' leaves it in hand, and it still counts as played", () => {
    const { state, events, id } = playOne(CLOBBER.card.id);
    expect(mustPlayer(state, P1).hand).toContain(id);
    expect(mustPlayer(state, P1).discard).not.toContain(id);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "cardMoved", instanceId: id, to: expect.objectContaining({ kind: "hand" }) }),
    );
  });

  it("…and when it is not the first card played this round, it is discarded as usual", () => {
    const { state, id } = playOne(CLOBBER.card.id, PLAIN.card.id);
    expect(mustPlayer(state, P1).discard).toContain(id);
  });

  it("'remove this card from the game' leaves it removed", () => {
    const { state, id } = playOne(GRAND.card.id);
    expect(state.removedFromGame).toContain(id);
    expect(mustPlayer(state, P1).discard).not.toContain(id);
  });

  it("an event that stays where it resolves is discarded as before", () => {
    const { state, id } = playOne(PLAIN.card.id);
    expect(mustPlayer(state, P1).discard).toContain(id);
  });
});
