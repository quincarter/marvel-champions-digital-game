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
  hasKeyword,
  iconsInPlay,
  isMinion,
  type EngineDeps,
  type GameState,
  type PlayerId,
} from "@mc/engine";

/** How many cards the next villain phase takes from the encounter deck, and what it is made of. */
export interface EncounterDemand {
  readonly total: number;
  readonly boost: number;
  /** Step 4: one per player, plus one more per hazard icon in play (RRG 1.8 "Hazard Icon"). */
  readonly dealt: number;
}

const livePlayers = (state: GameState) => state.players.filter((player) => !player.eliminated);

/**
 * One boost card per villain activation (the villain attacks or schemes once per player) and one per villainous minion
 * (it activates once), plus step 4's encounter cards: one per player and one per hazard icon in play for each.
 */
export function encounterDemandOf(state: GameState, deps: EngineDeps): EncounterDemand {
  const players = livePlayers(state).length;
  const villainous = cardsInPlay(state).filter(
    (id) => isMinion(state, id) && hasKeyword(state, id, "villainous", deps),
  );
  const boost = state.villains.length * players + villainous.length;
  const dealt = players * (1 + iconsInPlay(state, deps, "hazard"));
  return { total: boost + dealt, boost, dealt };
}

/** The encounter deck (and so its discard, which gets shuffled in) runs out when the round needs more than it holds. */
export function encounterRunsOut(state: GameState, deps: EngineDeps): boolean {
  return encounterDemandOf(state, deps).total > activeEncounterDeck(state).deck.length;
}

/** A player's deck runs out when the end-of-round draw up to hand size wants more than it holds. */
export function playerDeckRunsOut(state: GameState, deps: EngineDeps, playerId: PlayerId): boolean {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  return player !== undefined && !player.eliminated && handSize(state, playerId, deps) > player.deck.length;
}

/** The pile's reason for the table's text. */
export const RUNS_OUT_LINE = "Runs out next round";
