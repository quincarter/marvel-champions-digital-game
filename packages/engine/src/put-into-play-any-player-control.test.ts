/**
 * RRG 1.8 "Play, Put into Play" (pp. 32-33): "Unless otherwise stated by the 'put into play' effect, cards that are put
 * into play must do so in a play area or state that matches the rules of playing the card." FFG ruling Nov 21, 2025
 * (Build Support / Boot Camp): "because the ability does not state otherwise, you'd put the card found by Build Support
 * into play in a play area/state matching the rules of the card, which in the case of Boot Camp can include under the
 * control of another player." Who chooses the controller is not stated; the player putting the card in chooses, an
 * engine interpretation.
 *
 * So a card printed "Play under any player's control" that an effect puts into play enters under the player the one
 * putting it in chooses. Synthetic cards: a "Boot Camp" shaped support (any player's control, max 1 per player) and
 * an event that searches for it and puts it into play (Build Support's `putIntoPlay(chosen("found"), thatPlayer)`).
 */

import type { AnyCard, SupportCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });

/** "Play under any player's control. Max 1 per player." (Boot Camp, `wsp` 13016). */
const CAMP: SupportCard = {
  ...stubSupport({ id: "camp", cost: 2 }),
  playRestrictions: { anyPlayerControl: true, maxPerPlayer: 1 },
};

const event = (id: string, putIntoPlay: Partial<Extract<EffectSpec, { kind: "putIntoPlay" }>> = {}) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "chooseCards",
        slot: "found",
        from: { kind: "zone", zone: ["deck", "discard"], player: you, filter: { name: CAMP.name } },
        chooser: you,
        min: 1,
        max: 1,
      },
      { kind: "putIntoPlay", card: slot("found"), controller: you, ...putIntoPlay },
    ],
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Search your deck and discard pile for a card and put it into play." */
const FETCH = event("fetch");
/** "… and put it into play under your control." */
const FETCH_YOURS = event("fetch-yours", { controllerStated: true });

const deps: EngineDeps = depsOf(FETCH.ability, FETCH_YOURS.ability);
const PLAYER_CARDS: readonly AnyCard[] = [CAMP, FETCH.card, FETCH_YOURS.card];

function start(players: 1 | 2 = 2): GameState {
  return gameAtFirstTurn({
    players,
    cards: PLAYER_CARDS,
    deps,
    deck: [CAMP.id, CAMP.id, CAMP.id, ...[1, 2, 3].flatMap(() => [FETCH.card.id, FETCH_YOURS.card.id])],
  });
}
const campOf = (state: GameState, player: PlayerId): InstanceId => {
  const seat = mustPlayer(state, player);
  const id = [...seat.deck, ...seat.discard].find((i) => state.instances[i]?.cardId === CAMP.id);
  if (!id) throw new Error("no camp out of play");
  return id;
};
const campsIn = (state: GameState, player: PlayerId) =>
  mustPlayer(state, player).playArea.filter((id) => state.instances[id]?.cardId === CAMP.id);

/** `player` plays `card`; the control question picks `controlTo`, other prompts take the default. Replays exactly. */
function play(state: GameState, card: AnyCard, controlTo: PlayerId | null, player: PlayerId = P1) {
  const given = giveCard(state, player, card.id);
  const asked: { playerId: PlayerId; options: readonly string[] }[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind === "choosePlayer" && choice.prompt.slot === "putIntoPlayController") {
      asked.push({ playerId: choice.playerId, options: choice.options.map((o) => o.optionId) });
      // The question names the card it places ("Who controls Boot Camp?").
      expect(current.instances[choice.prompt.cardInstanceId!]?.cardId).toBe(CAMP.id);
      if (controlTo !== null) return [controlTo];
    }
    return defaultPick(current);
  };
  const command: Command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session, events } = driveSession(startSession(given.state), deps, [command], pick);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events: events as readonly GameEvent[], asked };
}

describe("Build Support / Boot Camp (ruling Nov 21, 2025): put into play under any player's control", () => {
  it("the player putting it in may put it under another player's control", () => {
    const base = start();
    const camp = campOf(base, P1);
    const { state, asked } = play(base, FETCH.card, P2);
    expect(asked).toEqual([{ playerId: P1, options: [P1, P2] }]);
    expect(campsIn(state, P2)).toEqual([camp]);
    expect(campsIn(state, P1)).toEqual([]);
    expect(mustInstance(state, camp).controllerId).toBe(P2);
    // Ownership does not change: it is still P1's card (RRG 1.8 "Ownership and Control", p. 31).
    expect(mustInstance(state, camp).ownerId).toBe(P1);
  });

  it("or under their own", () => {
    const base = start();
    const camp = campOf(base, P1);
    const { state } = play(base, FETCH.card, P1);
    expect(campsIn(state, P1)).toEqual([camp]);
    expect(mustInstance(state, camp).controllerId).toBe(P1);
  });

  it("'Max 1 per player' is read under the chosen player", () => {
    const one = play(start(), FETCH.card, P2).state;
    const second = campOf(one, P1);
    const two = play(one, FETCH.card, P2);
    expect(campsIn(two.state, P2)).toHaveLength(1);
    expect(two.events.filter((e) => e.type === "putIntoPlayRefused")).toEqual([
      { type: "putIntoPlayRefused", instanceId: second, playerId: P2, reason: "maxPerPlayer" },
    ]);
    // P2's copy does not stop P1 from taking one.
    const three = play(one, FETCH.card, P1);
    expect(campsIn(three.state, P1)).toEqual([second]);
  });

  it("an effect that states the controller asks nothing", () => {
    const { state, asked } = play(start(), FETCH_YOURS.card, P2);
    expect(asked).toEqual([]);
    expect(campsIn(state, P1)).toHaveLength(1);
    expect(campsIn(state, P2)).toEqual([]);
  });

  it("with one player there is no choice", () => {
    const { state, asked } = play(start(1), FETCH.card, null);
    expect(asked).toEqual([]);
    expect(campsIn(state, P1)).toHaveLength(1);
  });
});
