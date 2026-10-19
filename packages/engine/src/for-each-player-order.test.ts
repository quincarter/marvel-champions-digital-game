/**
 * docs/phase7-wave11-scenarios.md §S7 E27: a `forEachPlayer` whose order the first player chooses. RRG 1.8 "Each
 * Player" (p. 17): "If the effect does not specify what order the players resolve the effect in, the first player
 * decides the order." `order: "firstPlayerChooses"` asks with the `orderPlayers` prompt `dealEncounterCard` already
 * asks (`reason: "forEachPlayer"`); the default stays player order with no prompt. Proven with synthetic cards: each
 * player's pass deals that player the encounter deck's top card, so who holds which card shows the order.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, HERO, seatIdentities, VILLAIN } from "./testing/scenario.js";
import { MAIN_SCHEME } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const p3 = playerId("p3");

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const dealToThatPlayer: EffectSpec = { kind: "dealEncounterCard", player: { kind: "scoped" } };
const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const CHOSEN_ORDER = actionEvent("chosen-order", [
  { kind: "forEachPlayer", players: { kind: "each" }, effects: [dealToThatPlayer], order: "firstPlayerChooses" },
]);
const PLAYER_ORDER = actionEvent("player-order", [
  { kind: "forEachPlayer", players: { kind: "each" }, effects: [dealToThatPlayer] },
]);
const EVENTS = [CHOSEN_ORDER, PLAYER_ORDER];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function game(players: number): GameState {
  const identities = seatIdentities(HERO, players);
  const config: GameSetupConfig = {
    seed: 7,
    cards: [...DEFAULT_CARDS, VILLAIN, MAIN_SCHEME, BLANK, ...identities, ...EVENTS.map((e) => e.card)],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: copies(BLANK.id, 16),
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, ...EVENTS.map((e) => e.card.id)],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

function play(state: GameState, card: { readonly id: CardId }): GameState {
  const given = giveCard(state, p1, card.id);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function answer(state: GameState, selected: readonly string[]): GameState {
  const choice = state.pendingChoice!;
  const result = applyCommand(
    state,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

const topCards = (state: GameState, n: number) => activeEncounterDeck(state).deck.slice(0, n) as InstanceId[];

describe("§S7 E27 forEachPlayer in an order the first player chooses", () => {
  it("asks the first player to order the players, then resolves each pass in that order", () => {
    const start = game(3);
    const [a, b, c] = topCards(start, 3);
    const asked = play(start, CHOSEN_ORDER.card);

    const choice = asked.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "orderPlayers", reason: "forEachPlayer" });
    expect(choice?.authority).toBe("firstPlayerOrders");
    expect(choice?.playerId).toBe(asked.firstPlayerId);
    expect(choice?.ordered).toBe(true);
    expect(choice?.options.map((o) => o.optionId)).toEqual([p1, p2, p3]);
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([3, 3]);
    // Nothing resolves before the answer.
    expect(mustPlayer(asked, p1).dealtEncounter).toEqual([]);

    const done = runCommands(answer(asked, [p3, p1, p2]), deps).state;
    expect(mustPlayer(done, p3).dealtEncounter).toEqual([a]);
    expect(mustPlayer(done, p1).dealtEncounter).toEqual([b]);
    expect(mustPlayer(done, p2).dealtEncounter).toEqual([c]);
  });

  it("the same answer resolves the same way every time (replayable)", () => {
    const start = game(2);
    const once = runCommands(answer(play(start, CHOSEN_ORDER.card), [p2, p1]), deps).state;
    const again = runCommands(answer(play(start, CHOSEN_ORDER.card), [p2, p1]), deps).state;
    expect(mustPlayer(again, p1).dealtEncounter).toEqual(mustPlayer(once, p1).dealtEncounter);
    expect(mustPlayer(again, p2).dealtEncounter).toEqual(mustPlayer(once, p2).dealtEncounter);
  });

  it("one player is not asked", () => {
    const start = game(1);
    const [a] = topCards(start, 1);
    const done = play(start, CHOSEN_ORDER.card);
    expect(done.pendingChoice).toBeNull();
    expect(mustPlayer(done, p1).dealtEncounter).toEqual([a]);
  });

  it("without `order`, the passes resolve in player order and nothing is asked (every existing script)", () => {
    const start = game(2);
    const [a, b] = topCards(start, 2);
    const done = play(start, PLAYER_ORDER.card);
    expect(done.pendingChoice).toBeNull();
    expect(mustPlayer(done, p1).dealtEncounter).toEqual([a]);
    expect(mustPlayer(done, p2).dealtEncounter).toEqual([b]);
  });
});
