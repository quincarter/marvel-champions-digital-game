/**
 * docs/phase7-wave4.md §3.14: player events shuffled into the encounter deck. Synthetic cards shaped like the Cosmic
 * Entities (`mts` 21042 In-Betweener, "Action: Shuffle this card into the encounter deck (without looking). When
 * Revealed: Deal 2 damage to the villain and remove this card from the game. This effect cannot be canceled."; 21054
 * Eternity, "When Revealed: Draw 1 card and remove this card from the game. …") and a Black Widow-like "cancel the
 * effects of that card and discard it".
 *
 * Sources: the cards' own text; FAQ, RRG 1.8 p. 62 ("Where does a Cosmic Entity event go after it is resolved as a boost
 * card? That event is placed in the encounter deck discard pile."); ruling, Jan 17, 2026 (5) ("Playing Cosmic Entity
 * shuffles it into the active villain's encounter deck"); RRG 1.8 "Cancel", "'Cannot'" (p. 11).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, discardZoneFor, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, onTopOfEncounterDeck, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const shuffleIn = (id: string) =>
  stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: "encounterDeckShuffle" }],
  });
const whenRevealed = (id: string, effect: EffectSpec) =>
  stubAbility(`${id}.when-revealed`, {
    trigger: { kind: "whenRevealed" },
    uncancellable: true,
    effects: [effect, { kind: "moveCards", cards: { kind: "ref", ref: self }, to: "removedFromGame" }],
  } satisfies AbilityDefinition);

const IB_ACTION = shuffleIn("in-betweener");
const IB_REVEALED = whenRevealed("in-betweener", {
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: { kind: "const", value: 2 },
});
const IN_BETWEENER = stubEvent({ id: "in-betweener", cost: 0, abilities: [IB_ACTION.ref, IB_REVEALED.ref] });
const ETERNITY_ACTION = shuffleIn("eternity");
const ETERNITY_REVEALED = whenRevealed("eternity", {
  kind: "draw",
  player: { kind: "controller" },
  amount: { kind: "const", value: 1 },
});
const ETERNITY = stubEvent({ id: "eternity", cost: 0, abilities: [ETERNITY_ACTION.ref, ETERNITY_REVEALED.ref] });

/** "When an encounter card is revealed, cancel its effects and discard it" — forced, so it always tries. */
const WIDOW = stubAbility("widow.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "cancelRevealedCard" }],
});
const WIDOW_CARD = stubSupport({ id: "widow", cost: 0, abilities: [WIDOW.ref] });

const revealFor = (id: string, player: typeof P1) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: "revealEncounterCard", player: { kind: "id", playerId: player } }],
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const REVEAL = revealFor("reveal", P1);
const P2_REVEALS = revealFor("p2-reveals", P2);

const deps: EngineDeps = depsOf(
  IB_ACTION,
  IB_REVEALED,
  ETERNITY_ACTION,
  ETERNITY_REVEALED,
  WIDOW,
  REVEAL.ability,
  P2_REVEALS.ability,
);

function start(players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    cards: [IN_BETWEENER, ETERNITY, WIDOW_CARD, REVEAL.card, P2_REVEALS.card],
    deps,
    players,
    deck: [IN_BETWEENER.id, ETERNITY.id, WIDOW_CARD.id, REVEAL.card.id, P2_REVEALS.card.id],
  });
}
/** The copy the test put through the encounter deck: P1's (each player's deck holds one). */
const idOf = (state: GameState, cardId: string): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === cardId && i.ownerId === P1)!.instanceId;
const villainDamage = (state: GameState): number => mustInstance(state, state.activeVillainId).damage;

describe("§3.14 player events shuffled into the encounter deck", () => {
  it("played, it joins the active villain's encounter deck, still owned, controlled by nobody, discarding there", () => {
    const state = playFree(start(), deps, IN_BETWEENER.id).state;
    const id = idOf(state, IN_BETWEENER.id);
    const deckId = activeEncounterDeckId(state);
    expect(locateCard(state, id)).toEqual({ kind: "encounterDeck", deckId });
    const instance = mustInstance(state, id);
    expect(instance.ownerId).toBe(P1);
    expect(instance.controllerId).toBeNull();
    // FAQ (RRG 1.8 p. 62): discarded as a boost card, it goes to the encounter discard pile.
    expect(discardZoneFor(state, id)).toEqual({ kind: "encounterDiscard", deckId });
  });

  it("revealed, its When Revealed resolves and it is removed from the game; a cancel changes nothing", () => {
    const shuffled = playFree(start(), deps, IN_BETWEENER.id).state;
    const guarded = playerCardIntoPlay(onTopOfEncounterDeck(shuffled, IN_BETWEENER.id), WIDOW_CARD.id).state;
    const { state, session } = playFree(guarded, deps, REVEAL.card.id);
    const id = idOf(state, IN_BETWEENER.id);
    expect(villainDamage(state)).toBe(2);
    expect(locateCard(state, id)).toEqual({ kind: "removedFromGame" });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("'you' on the revealed card is the player who revealed it, not its owner", () => {
    const shuffled = playFree(start(2), deps, ETERNITY.id).state;
    const top = onTopOfEncounterDeck(shuffled, ETERNITY.id);
    const before = mustPlayer(top, P2).hand.length;
    const handP1 = mustPlayer(top, P1).hand.length;
    const state = playFree(top, deps, P2_REVEALS.card.id).state;
    expect(mustPlayer(state, P2).hand.length).toBe(before + 1);
    // P1's hand only lost the reveal event it played.
    expect(mustPlayer(state, P1).hand.length).toBe(handP1);
  });
});
