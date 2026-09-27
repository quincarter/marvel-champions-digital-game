/**
 * `GameSetupConfig.stack` (docs/guided-mode.md G1): named cards on top of decks after setup's seeded shuffle, for
 * tutorials and scripted scenarios. Not a rules feature, so what these pin is replay-safety: the stacked game is a
 * pure function of its config, and a config without a stack is untouched down to the RNG.
 */
import { describe, expect, it } from "vitest";
import { cardId, type AnyCard, type CardId } from "@mc/content";
import { DEFAULT_DEPS } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommands } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig, type SetupStack } from "./setup.js";
import type { GameState } from "./state.js";
import { syntheticCampaignInput } from "./testing/campaign.js";
import { runCommands } from "./testing/drive.js";
import { stubResource, stubTreachery } from "./testing/fixtures.js";
import { HERO, MAIN_SCHEME, VILLAIN, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

/** Distinct cards, so the order of a deck is visible in its card ids. */
const RESOURCES = Array.from({ length: 30 }, (_, n) => stubResource({ id: `res-${n}`, icons: 1 }));
const TREACHERIES = Array.from({ length: 12 }, (_, n) => stubTreachery({ id: `enc-${n}` }));
const DECK: readonly CardId[] = RESOURCES.map((card) => card.id);
const ENCOUNTER: readonly CardId[] = [...TREACHERIES.map((card) => card.id), cardId("enc-0")];
const identities = seatIdentities(HERO, 2);

function configFor(stack?: SetupStack, over: Partial<GameSetupConfig> = {}): GameSetupConfig {
  return {
    seed: 777,
    cards: [...RESOURCES, ...TREACHERIES, VILLAIN, MAIN_SCHEME, ...identities] as readonly AnyCard[],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: ENCOUNTER,
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: DECK })),
    ...(stack ? { stack } : {}),
    ...over,
  };
}

function setUp(stack?: SetupStack, over: Partial<GameSetupConfig> = {}) {
  const result = createGame(configFor(stack, over), DEFAULT_DEPS);
  if (!result.ok) throw new Error(`setup failed: ${result.error.message}`);
  return result;
}

const codes = (state: GameState, ids: readonly InstanceId[]): readonly string[] =>
  ids.map((id) => mustInstance(state, id).cardId);
/** A player's hand then deck: the deck order the shuffle (and the stack) produced, top first. */
const playerOrder = (state: GameState, id = p1): readonly InstanceId[] => {
  const player = mustPlayer(state, id);
  return [...player.hand, ...player.deck];
};
const encounterOrder = (state: GameState): readonly InstanceId[] =>
  state.encounterDecks[state.encounterDeckOrder[0] as string]?.deck ?? [];

describe("GameSetupConfig.stack", () => {
  it("puts the listed cards on top, first listed on top, and deals them into the opening hand", () => {
    const stack: SetupStack = {
      players: { 0: [cardId("res-29"), cardId("res-3"), cardId("res-17")] },
      encounter: [cardId("enc-11"), cardId("enc-4")],
    };
    const { state, events } = setUp(stack);
    expect(state.step).toMatchObject({ kind: "mulligan" });
    expect(codes(state, mustPlayer(state, p1).hand).slice(0, 3)).toEqual(["res-29", "res-3", "res-17"]);
    expect(codes(state, encounterOrder(state)).slice(0, 2)).toEqual(["enc-11", "enc-4"]);
    // The unstacked seat is untouched.
    expect(playerOrder(state, p2)).toEqual(playerOrder(setUp().state, p2));
    expect(state.setupStack).toEqual({ players: { p1: stack.players?.[0] }, encounter: stack.encounter });
    expect(events.filter((event) => event.type === "deckStacked").map((event) => event.zone.kind)).toEqual([
      "deck",
      "encounterDeck",
    ]);
  });

  it("keeps every other card in its shuffled order", () => {
    const plain = setUp().state;
    const stackedCodes = [cardId("res-29"), cardId("res-3")];
    const stacked = setUp({ players: { 0: stackedCodes }, encounter: [cardId("enc-7")] }).state;
    const take = (order: readonly InstanceId[], state: GameState, taken: readonly string[]) => {
      const rest = [...order];
      const top = taken.map(
        (code) =>
          rest.splice(
            rest.findIndex((id) => mustInstance(state, id).cardId === code),
            1,
          )[0],
      );
      return [...top, ...rest];
    };
    // Instance ids are allocated before the shuffle, so the two games name the same cards the same way.
    expect(playerOrder(stacked)).toEqual(take(playerOrder(plain), plain, stackedCodes));
    expect(encounterOrder(stacked)).toEqual(take(encounterOrder(plain), plain, ["enc-7"]));
  });

  it("takes the topmost copy of a duplicated code, and a code listed twice takes two copies", () => {
    const plain = setUp().state;
    const copies = encounterOrder(plain).filter((id) => mustInstance(plain, id).cardId === "enc-0");
    expect(copies).toHaveLength(2);
    const once = setUp({ encounter: [cardId("enc-0")] }).state;
    expect(encounterOrder(once)[0]).toBe(copies[0]);
    const twice = setUp({ encounter: [cardId("enc-0"), cardId("enc-0")] }).state;
    expect(encounterOrder(twice).slice(0, 2)).toEqual(copies);
  });

  it("refuses a code the deck does not hold, or holds fewer times than listed", () => {
    const refusals: readonly SetupStack[] = [
      { players: { 0: [cardId("enc-1")] } },
      { players: { 1: [cardId("res-1"), cardId("res-1")] } },
      { encounter: [cardId("res-1")] },
      { encounter: [cardId("enc-0"), cardId("enc-0"), cardId("enc-0")] },
      { players: { 2: [cardId("res-1")] } },
    ];
    for (const stack of refusals) {
      const result = createGame(configFor(stack), DEFAULT_DEPS);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.code).toBe("invalid_setup");
    }
  });

  it("leaves a game without a stack exactly as it was, down to the RNG", () => {
    const plain = setUp();
    expect(plain.state.setupStack).toBeUndefined();
    expect(plain.events.some((event) => event.type === "deckStacked")).toBe(false);
    // An empty stack is no stack.
    const empty = setUp({ players: { 0: [] }, encounter: [] });
    expect(empty.state).toEqual(plain.state);
    expect(empty.events).toEqual(plain.events);
    // Stacking reorders, and consumes no randomness.
    expect(setUp({ players: { 0: [cardId("res-5")] } }).state.rng).toEqual(plain.state.rng);
    // Pinned against the engine from before `stack` existed (seed 777): the shuffle this config always produced.
    expect(codes(plain.state, playerOrder(plain.state)).slice(0, 8)).toEqual(PINNED_P1_TOP_EIGHT);
    expect(codes(plain.state, encounterOrder(plain.state)).slice(0, 5)).toEqual(PINNED_ENCOUNTER_TOP_FIVE);
    expect(plain.state.rng).toEqual(PINNED_RNG);
  });

  it("replays exactly from { seed, stack, commands }", () => {
    const stack: SetupStack = { players: { 0: [cardId("res-9"), cardId("res-8")] }, encounter: [cardId("enc-2")] };
    const first = setUp(stack);
    const played = runCommands(first.state, DEFAULT_DEPS, { type: "endTurn", playerId: p1 } satisfies Command, {
      type: "endTurn",
      playerId: p2,
    });
    // Round 1's villain phase revealed the stacked encounter card to the first player.
    expect(played.events.some((e) => e.type === "encounterCardRevealed")).toBe(true);
    const again = setUp(stack);
    expect(again.state).toEqual(first.state);
    const replayed = applyCommands(again.state, played.session.log.commands, DEFAULT_DEPS);
    expect(replayed.ok).toBe(true);
    expect(replayed.ok && replayed.state).toEqual(played.state);
  });

  it("is applied after the shuffle in a campaign game too, where setup runs as a flow step", () => {
    const campaign = syntheticCampaignInput({
      seats: identities.map((identity, index) => ({
        seatNumber: index + 1,
        identityCardId: identity.id,
        deck: [],
        aspects: [],
        grantedCardIds: [],
      })),
    });
    const created = setUp({ players: { 1: [cardId("res-0"), cardId("res-1")] } }, { campaign });
    const driven = runCommands(created.state, DEFAULT_DEPS);
    const events = [...created.events, ...driven.events];
    const shuffled = events.findIndex((e) => e.type === "deckShuffled" && e.zone.kind === "deck");
    const stacked = events.findIndex((e) => e.type === "deckStacked");
    expect(shuffled).toBeGreaterThanOrEqual(0);
    expect(stacked).toBeGreaterThan(shuffled);
    const event = events[stacked];
    expect(event?.type === "deckStacked" && codes(driven.state, event.stacked)).toEqual(["res-0", "res-1"]);
    expect(event?.type === "deckStacked" && event.zone).toEqual({ kind: "deck", playerId: p2 });
    // Before anything drew: the first draw of the game is seat 2's stacked card when seat 2 draws.
    const firstDraw = events.findIndex((e) => e.type === "cardDrawn");
    expect(firstDraw).toBeGreaterThan(stacked);
  });
});

// Captured from the engine at d387718a, before `stack` existed, for the config above with no stack.
const PINNED_P1_TOP_EIGHT = ["res-4", "res-5", "res-21", "res-12", "res-15", "res-10", "res-22", "res-25"];
const PINNED_ENCOUNTER_TOP_FIVE = ["enc-9", "enc-0", "enc-5", "enc-4", "enc-2"];
const PINNED_RNG = { value: 3655556103, draws: 70 };
