/**
 * docs/phase7-wave6.md §3.64: `Predicate revealedFromEncounterDeck`, the SHOW environments' "If this card was revealed
 * from the encounter deck, it gains surge" (`mojo` 39035 …). True for a card revealed off the encounter deck and for a
 * facedown encounter card dealt from it; false for a search, a discard pile or a card dealt from anywhere else (§4 Q35).
 *
 * Sources: the MojoMania insert (p. 18: a SHOW environment revealed from the show deck or by Wheel of Genres "was not
 * 'revealed from the encounter deck'"); RRG 1.8 "Reveal" (p. 37), "Surge" (p. 42).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { activeEncounterDeckId } from "./query.js";
import { evaluate } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playFree } from "./testing/wave3.js";

const SHOW_REVEALED = stubAbility("show.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "if", condition: { kind: "revealedFromEncounterDeck" }, then: [{ kind: "gainSurge" }] }],
});
const SHOW = stubEnvironment({ id: "show", abilities: [SHOW_REVEALED.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const controller = { kind: "controller" } as const;
const found = { kind: "slot", slot: "found" } as const;
const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Reveal the top card of the encounter deck." */
const REVEAL_TOP = action("reveal-top", [{ kind: "revealEncounterCard", player: controller }]);
/** "Search the encounter deck for [the show] and reveal it." */
const SEARCH = action("search", [
  { kind: "selectCards", slot: "found", cards: { kind: "encounter", zones: ["deck"], filter: { name: SHOW.name } } },
  { kind: "revealCard", cards: found, player: controller },
]);
/** "Reveal [the show] from the encounter discard pile." */
const FROM_DISCARD = action("from-discard", [
  { kind: "selectCards", slot: "found", cards: { kind: "encounter", zones: ["discard"], filter: { name: SHOW.name } } },
  { kind: "revealCard", cards: found, player: controller },
]);
/** "Deal [the show] from the encounter discard pile to yourself as a facedown encounter card." */
const DEAL_FROM_DISCARD = action("deal-from-discard", [
  { kind: "selectCards", slot: "found", cards: { kind: "encounter", zones: ["discard"], filter: { name: SHOW.name } } },
  { kind: "dealAsEncounterCard", cards: found, player: controller },
]);

const ACTIONS = [REVEAL_TOP, SEARCH, FROM_DISCARD, DEAL_FROM_DISCARD];
const deps: EngineDeps = depsOf(SHOW_REVEALED, ...ACTIONS.map((a) => a.ability));
const ENCOUNTER: readonly CardId[] = [SHOW.id, ...copiesOf(FILLER.id, 6), ...copiesOf(BLANK.id, 20)];

const start = (): GameState =>
  gameAtFirstTurn({
    cards: [SHOW, BLANK, FILLER, ...ACTIONS.map((a) => a.card)],
    deps,
    encounter: ENCOUNTER,
    deck: ACTIONS.map((a) => a.card.id),
  });

function stacked(state: GameState, cards: readonly CardId[]): GameState {
  return [...cards].reverse().reduce((current, card) => onTopOfEncounterDeck(current, card), state);
}

/** The show moved from the encounter deck to its discard pile (surgery). */
function showInDiscard(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((candidate) => state.instances[candidate]?.cardId === SHOW.id)!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: piles.deck.filter((x) => x !== id), discard: [id, ...piles.discard] },
    },
  };
}

const summary = (events: readonly GameEvent[]) => ({
  revealed: events.flatMap((e) => (e.type === "encounterCardRevealed" ? [String(e.cardId)] : [])),
  surges: events.filter((e) => e.type === "surgeTriggered").length,
});

function villainPhase(state: GameState) {
  const { session, events } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]);
  return { session, ...summary(events) };
}

describe("§3.64 'If this card was revealed from the encounter deck'", () => {
  it("dealt from the encounter deck in the villain phase and revealed: it surges", () => {
    // The villain's boost draw takes the filler; p1 is dealt the show, which surges into a blank.
    const { revealed, surges } = villainPhase(stacked(start(), [FILLER.id, SHOW.id, BLANK.id]));
    expect(revealed).toEqual(["show", "blank"]);
    expect(surges).toBe(1);
  });

  it("revealed off the top of the encounter deck by an effect: it surges", () => {
    // Q22: in the player phase the blank its surge deals waits facedown; only the show is revealed.
    const { events, state } = playFree(stacked(start(), [SHOW.id, BLANK.id]), deps, REVEAL_TOP.card.id);
    expect(summary(events)).toEqual({ revealed: ["show"], surges: 1 });
    expect(state.players[0]!.dealtEncounter).toHaveLength(1);
  });

  it("found by a search of the encounter deck and revealed: no surge", () => {
    const { events } = playFree(start(), deps, SEARCH.card.id);
    expect(summary(events)).toEqual({ revealed: ["show"], surges: 0 });
  });

  it("revealed from the encounter discard pile: no surge", () => {
    const { events } = playFree(showInDiscard(start()), deps, FROM_DISCARD.card.id);
    expect(summary(events)).toEqual({ revealed: ["show"], surges: 0 });
  });

  it("dealt facedown from somewhere other than the encounter deck, then revealed in the villain phase: no surge", () => {
    const dealt = playFree(showInDiscard(start()), deps, DEAL_FROM_DISCARD.card.id).state;
    const show = dealt.players[0]!.dealtEncounter[0]!;
    expect(dealt.instances[show]?.dealtFromEncounterDeck).toBeUndefined();
    // The dealt show is revealed first, then the card step 3 dealt off the deck (after the villain's boost filler).
    const { revealed, surges } = villainPhase(stacked(dealt, [FILLER.id, BLANK.id]));
    expect(revealed).toEqual(["show", "blank"]);
    expect(surges).toBe(0);
  });

  it("is false outside the card's own reveal", () => {
    const state = start();
    const show = Object.values(state.instances).find((i) => i.cardId === SHOW.id)!.instanceId;
    const context = { selfInstanceId: show, controllerId: P1, event: null, bindings: {}, deps };
    expect(evaluate(state, { kind: "revealedFromEncounterDeck" }, context)).toBe(false);
  });

  it("the dealt-from-deck mark is gone once the card leaves the dealt encounter cards, and replays", () => {
    const { session } = villainPhase(stacked(start(), [FILLER.id, SHOW.id, BLANK.id]));
    expect(Object.values(session.state.instances).some((i) => i.dealtFromEncounterDeck)).toBe(false);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
