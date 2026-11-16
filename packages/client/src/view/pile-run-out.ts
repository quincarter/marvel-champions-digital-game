/**
 * Piles the next round will empty (issue #769): the encounter deck and a player's deck, tinted light red on the table.
 *
 * Running out has a price (RRG 1.8 "Encounter Deck", "Player Deck"): the encounter discard is shuffled back in and an
 * acceleration token goes on the main scheme; a player's deck is refilled from their discard and they are dealt an
 * extra encounter card. This module only counts what the round takes; the engine stays the authority on what happens.
 *
 * The count is a forecast, not a rule: it does not know about card abilities that draw or deal more.
 */

import {
  activeEncounterDeck,
  cardsInPlay,
  handSize,
  getInstance,
  getsBoostCard,
  stepThreeDealCount,
  isMinion,
  type EngineDeps,
  type GameState,
  type PlayerId,
} from "@mc/engine";

/** How many cards the next villain phase takes from the encounter deck, and what it is made of. */
export interface EncounterDemand {
  readonly total: number;
  readonly boost: number;
  /** Step 3: one per player (more at heroic level), plus one per hazard icon in play in total (RRG 1.8 "Hazard Icon"). */
  readonly dealt: number;
}

const livePlayers = (state: GameState) => state.players.filter((player) => !player.eliminated);

/**
 * What the next villain phase deals from the encounter deck, mirroring the engine's own steps:
 * - Step 2 boost cards: only the active villain activates, once per player (RRG 1.8 "Activation", p. 6; with several
 *   villains in play, MC45 "Active Villain" and MC21: only the active one activates), and each minion engaged with a
 *   live player whose activation gets a boost card (`getsBoostCard`: Villainous, gained or printed, RRG 1.8
 *   "Villainous", p. 47).
 * - Step 3: one card per player, X more each at heroic level X (RRG 1.8 "Modes of Play", p. 28), and one more per
 *   hazard icon in play in total, "not one card per player" (RRG 1.8 "Hazard Icon", p. 21) — the engine's
 *   `executeDealEncounterCards` count.
 * Stunned or confused activations, extra or withheld boost cards and surge are left out: an estimate, not a promise.
 */
export function encounterDemandOf(state: GameState, deps: EngineDeps): EncounterDemand {
  const live = livePlayers(state);
  const players = live.length;
  const liveIds = new Set(live.map((player) => player.playerId));
  const villainBoost = state.villains.length > 0 ? players : 0;
  const minionBoost = cardsInPlay(state).filter((id) => {
    const engagedWith = getInstance(state, id)?.engagedWith ?? null;
    return isMinion(state, id) && engagedWith !== null && liveIds.has(engagedWith) && getsBoostCard(state, deps, id);
  }).length;
  const boost = villainBoost + minionBoost;
  // Step 3 is the engine's own count (`stepThreeDealCount`, which `executeDealEncounterCards` deals).
  const dealt = stepThreeDealCount(state, deps);
  return { total: boost + dealt, boost, dealt };
}

/** The encounter deck (and so its discard, which gets shuffled in) runs out when the round takes at least as many cards as it holds. */
// A deck "runs out" on the move that takes its last card: RRG 1.8 "Encounter Deck" (p. 17) and "Player Deck" (p. 33)
// both say "immediately"; ruling April 30, 2026 (3), answer 7; docs/phase7-wave3.md §4 Q15. So a round that takes
// exactly what the deck holds empties it too: demand >= cards in the deck, when there is any demand at all.
export function encounterRunsOut(state: GameState, deps: EngineDeps): boolean {
  const demand = encounterDemandOf(state, deps).total;
  return demand > 0 && demand >= activeEncounterDeck(state).deck.length;
}

/**
 * A player's deck runs out when the end-of-round draw takes its last card. The draw is "until they have a number
 * of cards in hand equal to their hand size" (RRG 1.8 "Player Phase", end of turn), so it is hand size less the cards
 * held now: a floor, since the player may still play or discard cards this turn and draw more.
 */
export function playerDeckRunsOut(state: GameState, deps: EngineDeps, playerId: PlayerId): boolean {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (player === undefined || player.eliminated) return false;
  const draw = handSize(state, playerId, deps) - player.hand.length;
  return draw > 0 && draw >= player.deck.length;
}

/** The pile's reason for the table's text. */
export const RUNS_OUT_LINE = "Runs out next round";
