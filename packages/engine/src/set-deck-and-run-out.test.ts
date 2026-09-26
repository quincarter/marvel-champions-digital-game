/**
 * docs/phase7-wave4.md §3.6 (a modular set's own deck: the Infinity Stone deck) and §3.11 (timing points when a deck
 * runs out). Synthetic cards shaped like the Infinity Gauntlet set (`mts` 21129–21135): six Infinity Stone environments,
 * each "Special: … Place this card in the infinity stone deck discard pile", put into play from the top of the Infinity
 * Stone deck; Thanos I–III, "Forced Response: After the infinity stone deck runs out, give Thanos 1 facedown boost card";
 * Soul World (21033), "Response: After your deck runs out of cards, place 1 soul counter here."
 *
 * Sources: MC21 p. 16 ("This is the 'Infinity Stone deck.' The Infinity Stone deck has its own discard pile. When an
 * Infinity Stone environment is discarded, it is placed in the Infinity Stone deck discard pile. If the Infinity Stone
 * deck is ever empty, shuffle the Infinity Stone deck discard pile back into the Infinity Stone deck. There is no built-in
 * penalty for doing this."); RRG 1.8 "Special" (p. 40), "Player Deck" (p. 33).
 */

import { flat, trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, MAIN_SCHEME } from "./testing/scenario.js";
import { copiesOf, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const INFINITY_STONE = trait("INFINITY STONE");
const DECK = "Infinity Stone";
const self: TargetRef = { kind: "self" };
const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };
const count = (counterType: string, target: TargetRef = tracker): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount: { kind: "const", value: 1 },
});

const stone = (id: string) => {
  const special = stubAbility(`${id}.special`, {
    trigger: { kind: "special" },
    effects: [count("specials"), { kind: "discardFromPlay", target: self }],
  });
  return { card: stubEnvironment({ id, traits: [INFINITY_STONE], abilities: [special.ref] }), special };
};
const STONES = [stone("mind-stone"), stone("power-stone")];

/** "After the infinity stone deck runs out, give Thanos 1 facedown boost card" — counted on the tracker here. */
const THANOS_RAN_OUT = stubAbility("thanos.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "deckRanOut", eventIs: { deck: "scenario", name: DECK } } },
  effects: [count("stoneDeckRanOut")],
});
const THANOS = stubVillain({
  id: "thanos",
  stages: [{ hp: flat(30), atk: 0, sch: 0, abilities: [THANOS_RAN_OUT.ref] }],
});
/** Soul World: "After your deck runs out of cards" — a player's deck, answered by its controller. */
const SOUL_WORLD = stubAbility("soul-world.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "deckRanOut", playerIs: "controller", eventIs: { deck: "player" } },
  },
  effects: [count("soul", self)],
});
const TRACKER = stubSupport({ id: "tracker", cost: 0, abilities: [SOUL_WORLD.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Put the top card of the infinity stone deck into play." */
const NEXT_STONE = event("next-stone", [
  { kind: "selectCards", slot: "stone", cards: { kind: "scenarioDeck", name: DECK, top: { kind: "const", value: 1 } } },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "stone" }, controller: { kind: "firstPlayer" } },
]);
/** "Resolve the Special ability of each Infinity Stone in play." */
const GAUNTLET = event("gauntlet", [{ kind: "resolveSpecials", cards: { trait: INFINITY_STONE } }]);
/** Draws the player's whole deck, so it runs out. */
const DRAW_ALL = event("draw-all", [
  { kind: "draw", player: { kind: "controller" }, amount: { kind: "deckCount", player: { kind: "controller" } } },
]);
/** "Shuffle the infinity stone deck discard pile into the infinity stone deck" (Infinite Mischief, §3.49). */
const MISCHIEF = event("mischief", [
  {
    kind: "moveCards",
    cards: { kind: "scenarioDeck", name: DECK, zones: ["discard"] },
    to: "scenarioDeckShuffle",
  },
]);
const EVENTS = [NEXT_STONE, GAUNTLET, DRAW_ALL, MISCHIEF];

const deps: EngineDeps = depsOf(
  THANOS_RAN_OUT,
  SOUL_WORLD,
  ...STONES.map((s) => s.special),
  ...EVENTS.map((e) => e.ability),
);

function start(): { state: GameState; tracker: InstanceId } {
  const result = createGame(
    {
      seed: 3,
      cards: [...DEFAULT_CARDS, THANOS, TRACKER, FILLER, ...STONES.map((s) => s.card), ...EVENTS.map((e) => e.card)],
      villainCardId: THANOS.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [...copiesOf(FILLER.id, 10), ...STONES.map((s) => s.card.id)],
      scenarioDecks: [
        {
          name: DECK,
          contents: { trait: INFINITY_STONE },
          discardPile: "own",
          whenEmpty: "reshuffleDiscardWithoutPenalty",
          buildAtSetup: true,
        },
      ],
      includeIdentitySets: false,
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, TRACKER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 3))],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const state = driveSession(startSession(result.state), deps).session.state;
  const placed = playerCardIntoPlay(state, TRACKER.id);
  return { state: placed.state, tracker: placed.id };
}
const counter = (state: GameState, id: InstanceId, type: string): number => mustInstance(state, id).counters[type] ?? 0;
const stoneIds = (state: GameState): readonly InstanceId[] =>
  Object.values(state.instances)
    .filter((i) => STONES.some((s) => s.card.id === (i.cardId as CardId)))
    .map((i) => i.instanceId);

describe("§3.6 a modular set's own deck", () => {
  it("is built from the set's cards at setup: none stay in the encounter deck, and each discards to the set's own pile", () => {
    const { state } = start();
    expect(state.scenarioDecks[DECK]?.deck).toHaveLength(2);
    for (const id of stoneIds(state)) {
      expect(locateCard(state, id)).toEqual({ kind: "scenarioDeck", name: DECK });
      expect(mustInstance(state, id).home).toEqual({ kind: "scenarioDeck", name: DECK });
    }
  });

  it("its top card is put into play; its Special resolves and it goes to the Infinity Stone discard pile", () => {
    const { state, tracker } = start();
    const inPlay = playFree(state, deps, NEXT_STONE.card.id).state;
    expect(inPlay.villainArea.some((id) => stoneIds(inPlay).includes(id))).toBe(true);
    const resolved = playFree(inPlay, deps, GAUNTLET.card.id).state;
    expect(counter(resolved, tracker, "specials")).toBe(1);
    expect(resolved.scenarioDecks[DECK]?.discard).toHaveLength(1);
  });
});

describe("§3.11 timing points when a deck runs out", () => {
  it("taking the scenario deck's last card announces it ran out, once; the deck then takes its discard pile back", () => {
    const { state, tracker } = start();
    const first = playFree(state, deps, NEXT_STONE.card.id).state;
    const discarded = playFree(first, deps, GAUNTLET.card.id).state;
    expect(counter(discarded, tracker, "stoneDeckRanOut")).toBe(0);
    const { state: second, session } = playFree(discarded, deps, NEXT_STONE.card.id);
    expect(counter(second, tracker, "stoneDeckRanOut")).toBe(1);
    // No penalty: the discarded stone is shuffled back and nothing else changed.
    expect(second.scenarioDecks[DECK]?.deck).toHaveLength(1);
    expect(second.scenarioDecks[DECK]?.discard).toHaveLength(0);
    expect(second.mainScheme.accelerationTokens).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a player's deck that runs out (and resets) is announced to that player's cards", () => {
    const { state, tracker } = start();
    const after = playFree(state, deps, DRAW_ALL.card.id, P1).state;
    expect(mustPlayer(after, P1).deck.length).toBeGreaterThan(0); // It reset from the discard pile.
    expect(counter(after, tracker, "soul")).toBe(1);
  });
});

describe("§3.49 shuffling a scenario deck's discard pile back in, on demand", () => {
  it("the discarded stone goes back into the Infinity Stone deck, which is shuffled", () => {
    const { state } = start();
    const discarded = playFree(playFree(state, deps, NEXT_STONE.card.id).state, deps, GAUNTLET.card.id).state;
    expect(discarded.scenarioDecks[DECK]?.discard).toHaveLength(1);
    const [stone] = discarded.scenarioDecks[DECK]!.discard;
    const { state: after, events } = playFree(discarded, deps, MISCHIEF.card.id);
    expect(after.scenarioDecks[DECK]?.discard).toHaveLength(0);
    expect(after.scenarioDecks[DECK]?.deck).toHaveLength(2);
    expect(locateCard(after, stone!)).toEqual({ kind: "scenarioDeck", name: DECK });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "deckShuffled", zone: { kind: "scenarioDeck", name: DECK } }),
    );
  });
});
