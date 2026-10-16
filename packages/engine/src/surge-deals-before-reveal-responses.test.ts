/**
 * The surge keyword deals its card while the surging card's When Revealed abilities resolve (reveal step 3), not
 * after the responses to the reveal; the dealt card is revealed later, in its place in the player's queue.
 *
 * Sources: RRG v1.8 p.42 "Surge": "The surge keyword is equivalent to the following triggered ability: 'When Revealed:
 * Deal yourself 1 facedown encounter card.' Complete the process of resolving the original card, as well as any
 * response abilities that are triggered by that card being revealed, before revealing the additional card." RRG v1.8
 * p.38 "Reveal" step 3 ("Resolve each 'When Revealed' ability on that card (including those provided by keywords)")
 * and "Responses ... to any step of the revealing of an encounter card are not resolved until after all steps of the
 * reveal process have been completed." Owner decision 2026-10-16 (audit finding 16): dealing and revealing are two
 * operations; a response to the original card's reveal cannot change which card the surge dealt. The "would be
 * resolved" interrupt window of the keyword (Espionage) stays on its own frame (`surgeResolving`), and Media
 * Coverage's repeat still deals one card per repeat (ruling Aug 3, 2026 (3)).
 *
 * Synthetic cards only; every encounter card has 0 boost icons.
 */

import type { AbilityReference, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { PlayerId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;

/** "Surge." */
const RUSH = stubTreachery({ id: "rush", boostIcons: 0, keywords: [{ name: "surge" }] });
const A = stubTreachery({ id: "a", boostIcons: 0 });
const B = stubTreachery({ id: "b", boostIcons: 0 });
const C = stubTreachery({ id: "c", boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

/** "Reveal the top card of the encounter deck." */
const revealTop = stubAbility("reveal-top.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: you }],
});
const REVEAL_TOP = stubEvent({ id: "reveal-top", cost: 0, abilities: [revealTop.ref as AbilityReference] });

const support = (id: string, trigger: Parameters<typeof stubAbility>[1]["trigger"], effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.ability`, { trigger, effects });
  return { card: stubSupport({ id, cost: 0, abilities: [ability.ref as AbilityReference] }), ability };
};
/** "Forced Response: After an encounter card is revealed, discard the top card of the encounter deck." */
const MILL = support("mill", { kind: "response", forced: true, on: { on: "cardRevealed" } }, [
  { kind: "discardEncounterCards", count: n(1) },
]);
/** Espionage's shape: "Interrupt: When the surge keyword on an encounter card would be resolved, draw 2 cards." */
const SPY = support("spy", { kind: "interrupt", forced: true, on: { on: "surgeResolving", playerIs: "controller" } }, [
  { kind: "draw", player: you, amount: n(2) },
]);
/** "Forced Interrupt: When the surge keyword would be resolved, cancel it." */
const STOP = support("stop", { kind: "interrupt", forced: true, on: { on: "surgeResolving" } }, [
  { kind: "cancelTriggeringEvent" },
]);
/** Media Coverage's rule: "Resolve each 'When Revealed' ability that you reveal 1 additional time." */
const COVERAGE = support(
  "coverage",
  { kind: "constant", rules: [{ kind: "repeatWhenRevealed", player: { kind: "controller" }, times: 1 }] },
  [],
);
const SUPPORTS = [MILL, SPY, STOP, COVERAGE];

const deps: EngineDeps = depsOf(revealTop, ...SUPPORTS.map((s) => s.ability));

const start = (...inPlay: readonly CardId[]): GameState =>
  inPlay.reduce(
    (state, card) => playerCardIntoPlay(state, card).state,
    gameAtFirstTurn({
      cards: [RUSH, A, B, C, FILLER, REVEAL_TOP, ...SUPPORTS.map((s) => s.card)],
      deps,
      deck: [REVEAL_TOP.id, ...SUPPORTS.map((s) => s.card.id)],
      encounter: [...copiesOf(FILLER.id, 20), RUSH.id, A.id, B.id, C.id],
    }),
  );

/** The encounter deck with a card of each of `codes` on top, the first of them topmost (test surgery). */
const stacked = (state: GameState, ...codes: readonly CardId[]): GameState => {
  const [deckId, piles] = Object.entries(state.encounterDecks)[0]!;
  const rest = [...piles.deck];
  const top = codes.map((code) => {
    const at = rest.findIndex((id) => mustInstance(state, id).cardId === code);
    if (at < 0) throw new Error(`no ${code} left in the encounter deck`);
    return rest.splice(at, 1)[0]!;
  });
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: [...top, ...rest] } } };
};

const dealtTo = (state: GameState, player: PlayerId = P1) =>
  mustPlayer(state, player).dealtEncounter.map((id) => mustInstance(state, id).cardId as string);
const discardedCards = (state: GameState) =>
  activeEncounterDeck(state).discard.map((id) => mustInstance(state, id).cardId as string);
const reveals = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [e.cardId as string] : []));
const surgeDeals = (events: readonly GameEvent[]) => events.filter((e) => e.type === "surgeTriggered").length;
const millAt = (events: readonly GameEvent[]) =>
  events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === MILL.ability.ref.id);

describe("surge deals its card in reveal step 3, before the responses to the reveal (RRG v1.8 p.42, p.38; audit finding 16)", () => {
  it("a response that discards the top of the encounter deck comes after the deal: the surge dealt the card below the surging one", () => {
    const at = stacked(start(MILL.card.id), RUSH.id, A.id, B.id);
    const { state, events } = playFree(at, deps, REVEAL_TOP.id);
    expect(reveals(events)).toEqual(["rush"]);
    expect(surgeDeals(events)).toBe(1);
    // The surge took A off the top while the surging card was being revealed; the response then discarded B.
    expect(dealtTo(state)).toEqual(["a"]);
    expect(discardedCards(state)).toEqual(expect.arrayContaining(["rush", "b"]));
    expect(discardedCards(state)).not.toContain("a");
    const dealtAt = events.findIndex((e) => e.type === "surgeTriggered");
    expect(millAt(events)).toBeGreaterThan(dealtAt);
    // Dealt, not revealed: the card waits facedown.
    const [waiting] = mustPlayer(state, P1).dealtEncounter;
    expect(mustInstance(state, waiting!).faceup).toBe(false);
  });

  it("in step four of the villain phase: the dealt card is revealed next, in the queue, and the response did not change it", () => {
    // The villain's boost card is a filler; step three deals the surging card; the surge deals A; the response mills B.
    const at = stacked(start(MILL.card.id), FILLER.id, RUSH.id, A.id, B.id, C.id);
    const { state, events } = runCommands(at, deps, { type: "endTurn", playerId: P1 });
    expect(reveals(events)).toEqual(["rush", "a"]);
    expect(surgeDeals(events)).toBe(1);
    expect(discardedCards(state)).toEqual(expect.arrayContaining(["rush", "b", "a"]));
    expect(dealtTo(state)).toEqual([]);
  });

  it("the keyword's own interrupt window (Espionage's shape) still opens, before its card is dealt", () => {
    const at = stacked(start(SPY.card.id), RUSH.id, A.id, B.id);
    const { state, events } = playFree(at, deps, REVEAL_TOP.id);
    const draws = events.flatMap((e, i) => (e.type === "cardDrawn" ? [i] : []));
    expect(draws).toHaveLength(2);
    expect(Math.max(...draws)).toBeLessThan(events.findIndex((e) => e.type === "surgeTriggered"));
    expect(dealtTo(state)).toEqual(["a"]);
  });

  it("cancelled in that window, the surge deals nothing", () => {
    const at = stacked(start(STOP.card.id), RUSH.id, A.id, B.id);
    const { state, events } = playFree(at, deps, REVEAL_TOP.id);
    expect(surgeDeals(events)).toBe(0);
    expect(dealtTo(state)).toEqual([]);
  });

  it("under Media Coverage's repeat both surge deals come before the response (one card per repeat)", () => {
    const at = stacked(start(COVERAGE.card.id, MILL.card.id), RUSH.id, A.id, B.id, C.id);
    const { state, events } = playFree(at, deps, REVEAL_TOP.id);
    expect(surgeDeals(events)).toBe(2);
    expect(dealtTo(state)).toEqual(["a", "b"]);
    expect(discardedCards(state)).toEqual(expect.arrayContaining(["rush", "c"]));
    const deals = events.flatMap((e, i) => (e.type === "surgeTriggered" ? [i] : []));
    expect(millAt(events)).toBeGreaterThan(Math.max(...deals));
  });
});
