/**
 * docs/phase7-wave10-box-heroes.md B3.3: `on.aPlayerDiscardsFromTheirDeck()` and `stillCountedByDiscarder`, in a real
 * game: the Hulkling starter deck against Core's Rhino, with Hulkling's nemesis set. The engine side is driven by
 * `packages/engine/src/deck-discard-under-scheme.test.ts`.
 *
 * Skrull Business 56056: "Forced Response: After any number of cards are discarded from the top of a player's deck,
 * place those cards facedown under this scheme." You're Coming With Me! 56058: "When Revealed (Hero): Discard the top
 * 3 cards of your deck. Take 1 damage for each different resource icon on the discarded cards ([energy], [mental],
 * [physical], or [wild])." Hulkling's nemesis module is scripted elsewhere, so this file registers both texts itself,
 * written as that module can write them. The discarded cards are the deck's own: Shapeshifter Strike 56037 (energy),
 * Defensive Conditioning 56046 (physical), "I Can Do This All Day" 56047 (mental).
 *
 * Owner decision, 2026-10-11, box-heroes question 14 = A (provisional; kept 2026-10-16): the discarding ability still
 * counts the cards it discarded, reading their printed icons, though Skrull Business has taken them. RRG 1.8
 * "Triggering Condition" (p. 45), "Tuck" (p. 45).
 *
 * RRG v1.8 p.38; owner decision 2026-10-16 (audit finding 18): when the discarding ability is a revealed card's When
 * Revealed, Skrull Business's Forced Response waits until the reveal has finished, so the count is made before the
 * cards are taken and question 14 does not come up. Its case is shown with the same two sentences resolving outside a
 * reveal, as a test stand-in hero action (`OUTSIDE_REVEAL`).
 */

import { cardId } from "@mc/content";
import { cardsInPlay, type EngineDeps, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
} from "../testing/harness.js";
import { driveEventsPicking, stageNemesisCardForReveal } from "../testing/staging.js";
import { heroThwarts } from "../wave9/testing.js";
import { WAVE10_DEPS, hulklingHeroGame } from "../wave10/testing.js";
import { forcedResponse, heroAction, on, stillCountedByDiscarder, whenRevealedHero } from "./abilities.js";
import { cards, moveCards, takeDamage, topOfDeck, tuckCards } from "./effects.js";
import { defineAbilities, validateDefinition } from "./validate.js";
import { chosen, eventTargetsTogether, resourceTypesOf, self } from "./values.js";

vi.setConfig({ testTimeout: 120_000 });

const SKRULL_BUSINESS = "56056";
const COMING_WITH_ME = "56058";
const STRIKE = "56037"; // Shapeshifter Strike: energy
const CONDITIONING = "56046"; // Defensive Conditioning: physical
const ALL_DAY = "56047"; // "I Can Do This All Day": mental

/** "Forced Response: After any number of cards are discarded from the top of a player's deck, place those cards facedown under this scheme." */
const RESPONSE = stillCountedByDiscarder(
  forcedResponse(on.aPlayerDiscardsFromTheirDeck(), tuckCards(cards(eventTargetsTogether), self, true)),
);
/** "When Revealed (Hero): Discard the top 3 cards of your deck. Take 1 damage for each different resource icon on the discarded cards." */
const REVEALED_HERO = whenRevealedHero(
  moveCards(topOfDeck(3), "discard", "discarded"),
  takeDamage(resourceTypesOf(chosen("discarded"))),
);
const SCRIPTS = defineAbilities({
  "56056.skrull-business-forced-response": RESPONSE,
  "56058.when-revealed-hero": REVEALED_HERO,
});
const deps: EngineDeps = { ...WAVE10_DEPS, abilities: { ...WAVE10_DEPS.abilities, ...SCRIPTS } };
/**
 * Test stand-in: Shapeshifter Strike 56037's script replaced by You're Coming With Me!'s two sentences as a hero
 * action, so the same discard and count resolve on a player's turn with no reveal in progress.
 */
const OUTSIDE_REVEAL = defineAbilities({
  "56037.shapeshifter-strike-action": heroAction(
    moveCards(topOfDeck(3), "discard", "discarded"),
    takeDamage(resourceTypesOf(chosen("discarded"))),
  ),
});
const outsideDeps: EngineDeps = { ...deps, abilities: { ...deps.abilities, ...OUTSIDE_REVEAL } };

/** Surgery: player 1's set-aside Skrull Business in the villain's play area with 5 threat. */
function withSkrullBusiness(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const id = playerOf(state, P1).setAside.find((i) => state.instances[i]?.cardId === cardId(SKRULL_BUSINESS));
  if (!id) throw new Error("Skrull Business is not set aside");
  const placed: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    villainArea: [...state.villainArea, id],
  };
  return { id, state: patchInstance(placed, id, { faceup: true, threat: 5 }) };
}
/**
 * Surgery: cards from the bottom of player 1's deck into their hand until it holds `size` again, so a card the
 * stacking took from the hand is not replaced by a draw off the top at the end of the turn.
 */
function refilled(state: GameState, size: number): GameState {
  const seat = playerOf(state, P1);
  const missing = Math.max(0, size - seat.hand.length);
  if (missing === 0) return state;
  const moved = seat.deck.slice(-missing);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.slice(0, -missing), hand: [...p.hand, ...moved] } : p,
    ),
  };
}
/** You're Coming With Me! revealed to player 1 over `top`, with or without Skrull Business in play. */
function revealedOver(top: readonly string[], opts: { readonly scheme: boolean }) {
  const start = hulklingHeroGame({ deps });
  const scheme = opts.scheme ? withSkrullBusiness(start) : null;
  const stacked = putOnTopOfDeck(scheme?.state ?? start, P1, ...top);
  const staged = stageNemesisCardForReveal(refilled(stacked.state, playerOf(start, P1).hand.length), COMING_WITH_ME);
  const [treachery] = instancesOf(staged, COMING_WITH_ME);
  const run = driveEventsPicking(deps, staged, firstLegal, endTurn());
  return { ...run, scheme: scheme?.id ?? null, top: stacked.ids, treachery: treachery! };
}
/** The stand-in hero action played by player 1 over `top`, with Skrull Business in play. */
function playedOver(top: readonly string[]) {
  const start = withSkrullBusiness(hulklingHeroGame({ deps: outsideDeps }));
  const stacked = putOnTopOfDeck(start.state, P1, ...top);
  const id = playerOf(stacked.state, P1).deck.find(
    (i) => stacked.state.instances[i]?.cardId === cardId(STRIKE) && !stacked.ids.includes(i),
  );
  if (!id) throw new Error("no other Shapeshifter Strike in the deck");
  const inHand: GameState = {
    ...stacked.state,
    players: stacked.state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), hand: [...p.hand, id] } : p,
    ),
  };
  const run = driveEventsPicking(outsideDeps, inHand, firstLegal, play(P1, id, payWith(inHand, P1, 2, [id])));
  return { ...run, scheme: start.id, top: stacked.ids, played: id };
}
const damageFrom = (events: readonly GameEvent[], source: InstanceId) =>
  events.reduce((sum, e) => (e.type === "damageDealt" && e.sourceInstanceId === source ? sum + e.amount : sum), 0);
const responses = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === "56056.skrull-business-forced-response");

describe("B3.3 the DSL surface", () => {
  it("builds a pattern for any player's deck, answered once, and the marked response is valid plain data", () => {
    expect(on.aPlayerDiscardsFromTheirDeck()).toEqual({ on: "cardDiscardedFromDeck", together: true });
    expect(RESPONSE.discardsStayCounted).toBe(true);
    expect(RESPONSE.effects).toEqual([
      { kind: "tuckCards", cards: { kind: "ref", ref: eventTargetsTogether }, under: { kind: "self" }, facedown: true },
    ]);
    expect(validateDefinition(RESPONSE)).toEqual([]);
    expect(validateDefinition(REVEALED_HERO)).toEqual([]);
    expect(JSON.parse(JSON.stringify(RESPONSE))).toEqual(RESPONSE);
  });

  it("the mark is refused on anything but a response to a deck discard", () => {
    expect(validateDefinition(stillCountedByDiscarder(heroAction(takeDamage(1))))).toEqual([
      "stillCountedByDiscarder needs a response to cards discarded from a deck (on.aPlayerDiscardsFromTheirDeck(), …)",
    ]);
  });
});

describe("B3.3 Skrull Business 56056 with You're Coming With Me! 56058, Hulkling against Core Rhino", () => {
  it("three cards discarded: one forced response, all three facedown under the scheme, none in the discard pile", () => {
    const run = revealedOver([STRIKE, CONDITIONING, ALL_DAY], { scheme: true });
    expect(responses(run.events)).toHaveLength(1);
    expect(inst(run.state, run.scheme!).tucked).toEqual(run.top);
    expect(run.top.map((id) => inst(run.state, id).faceup)).toEqual([false, false, false]);
    expect(playerOf(run.state, P1).discard.filter((id) => run.top.includes(id))).toEqual([]);
  });

  // RRG v1.8 p.38; owner decision 2026-10-16 (audit finding 18).
  it("revealed: the response waits for the end of the reveal, so the 3 damage is counted from the discard pile and the cards are tucked afterwards (RRG v1.8 p.38)", () => {
    const run = revealedOver([STRIKE, CONDITIONING, ALL_DAY], { scheme: true });
    expect(damageFrom(run.events, run.treachery)).toBe(3);
    // Nothing had taken the cards when they were counted: question 14 does not come up.
    expect(run.events.filter((e) => e.type === "deckDiscardStillCounted")).toEqual([]);
    expect(run.events.filter((e) => e.type === "deckDiscardNotCounted")).toEqual([]);
    // The discard itself is not deferred: the cards left the deck before the damage; only the tuck waited.
    const discardedAt = run.events.findIndex((e) => e.type === "cardMoved" && e.instanceId === run.top[0]);
    const damagedAt = run.events.findIndex((e) => e.type === "damageDealt" && e.sourceInstanceId === run.treachery);
    const respondedAt = run.events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === "56056.skrull-business-forced-response",
    );
    expect(discardedAt).toBeLessThan(damagedAt);
    expect(damagedAt).toBeLessThan(respondedAt);
  });

  it("question 14 = A, outside a reveal: energy, physical and mental under the scheme still deal Hulkling 3 damage", () => {
    const run = playedOver([STRIKE, CONDITIONING, ALL_DAY]);
    expect(run.events.some((e) => e.type === "encounterCardRevealed")).toBe(false);
    expect(responses(run.events)).toHaveLength(1);
    expect(inst(run.state, run.scheme).tucked).toEqual(run.top);
    expect(damageFrom(run.events, run.played)).toBe(3);
    expect(run.events.filter((e) => e.type === "deckDiscardStillCounted").map((e) => e.instanceId)).toEqual(run.top);
    expect(run.events.filter((e) => e.type === "deckDiscardNotCounted")).toEqual([]);
  });

  it("three energy cards under the scheme deal 1 damage", () => {
    const run = revealedOver([STRIKE, STRIKE, STRIKE], { scheme: true });
    expect(inst(run.state, run.scheme!).tucked).toEqual(run.top);
    expect(damageFrom(run.events, run.treachery)).toBe(1);
  });

  it("without Skrull Business the same reveal deals the same 3 damage and the cards are in the discard pile", () => {
    const run = revealedOver([STRIKE, CONDITIONING, ALL_DAY], { scheme: false });
    expect(damageFrom(run.events, run.treachery)).toBe(3);
    expect(playerOf(run.state, P1).discard).toEqual(expect.arrayContaining([...run.top]));
    expect(responses(run.events)).toEqual([]);
  });

  it("the scheme thwarted to 0: the three cards are in Hulkling's discard pile, faceup", () => {
    const run = revealedOver([STRIKE, CONDITIONING, ALL_DAY], { scheme: true });
    const low = patchInstance(patchInstance(run.state, run.scheme!, { threat: 1 }), identityOf(run.state, P1), {
      exhausted: false,
    });
    const { state } = heroThwarts(deps, low, run.scheme!);
    expect(cardsInPlay(state)).not.toContain(run.scheme);
    expect(playerOf(state, P1).discard).toEqual(expect.arrayContaining([...run.top]));
    expect(run.top.map((id) => inst(state, id).faceup)).toEqual([true, true, true]);
  });
});
