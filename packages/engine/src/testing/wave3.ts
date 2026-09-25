/**
 * Shared scaffolding for the docs/phase7-wave3.md §3 primitive tests: a game at the first player's first turn, playing
 * a 0-cost event from hand, and test-only state surgery that puts a card straight into play. Surgery happens before a
 * session starts, so a replay of that session's log reproduces it exactly.
 */

import type { AnyCard, CardId, MainSchemeCard, VillainCard } from "@mc/content";
import type { EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import { startSession, type GameSession } from "../engine.js";
import type { GameEvent } from "../events.js";
import { playerId, type InstanceId, type PlayerId } from "../ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "../query.js";
import { createGame, type GameSetupConfig } from "../setup.js";
import type { GameState } from "../state.js";
import { driveSession } from "./drive.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  giveCard,
  HERO,
  MAIN_SCHEME,
  seatIdentities,
  TREACHERY,
  VILLAIN,
} from "./scenario.js";

export const P1: PlayerId = playerId("p1");
export const P2: PlayerId = playerId("p2");

export const copiesOf = (id: CardId, count: number): readonly CardId[] => Array.from({ length: count }, () => id);

export interface Wave3Game {
  readonly cards: readonly AnyCard[];
  readonly deps: EngineDeps;
  readonly villain?: VillainCard;
  readonly mainScheme?: MainSchemeCard;
  /** The encounter deck (default 30 blank treacheries). */
  readonly encounter?: readonly CardId[];
  /** Extra cards for each seat's deck, on top of the default deck. */
  readonly deck?: readonly CardId[];
  readonly players?: 1 | 2;
  readonly seed?: number;
  /** `GameSetupConfig.scenarioRuleSpecs` (docs/phase7-wave4.md §3.40). */
  readonly scenarioRuleSpecs?: GameSetupConfig["scenarioRuleSpecs"];
}

/** A game past setup, at the first player's first turn. */
export function gameAtFirstTurn(options: Wave3Game): GameState {
  const identities = seatIdentities(HERO, options.players ?? 1);
  const villain = options.villain ?? VILLAIN;
  const mainScheme = options.mainScheme ?? MAIN_SCHEME;
  const result = createGame(
    {
      seed: options.seed ?? 21,
      cards: [...DEFAULT_CARDS, ...identities.slice(1), villain, mainScheme, ...options.cards],
      villainCardId: villain.id,
      mainSchemeCardId: mainScheme.id,
      encounterDeck: options.encounter ?? copiesOf(TREACHERY.id, 30),
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, ...(options.deck ?? [])],
      })),
      ...(options.scenarioRuleSpecs ? { scenarioRuleSpecs: options.scenarioRuleSpecs } : {}),
    },
    options.deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), options.deps).session.state;
}

/** Hands `player` a copy of `card` (test surgery), then plays it for 0 through a fresh session on that state. */
export function playFree(
  state: GameState,
  deps: EngineDeps,
  card: CardId,
  player: PlayerId = P1,
  more: readonly Command[] = [],
): { readonly session: GameSession; readonly state: GameState; readonly events: readonly GameEvent[] } {
  const given = giveCard(state, player, card);
  const { session, events } = driveSession(startSession(given.state), deps, [
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ...more,
  ]);
  return { session, state: session.state, events };
}

/** Moves a player card from `player`'s deck, hand or discard straight into their play area, under their control. */
export function playerCardIntoPlay(
  state: GameState,
  card: CardId,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = giveCard(state, player, card);
  const seat = mustPlayer(given.state, player);
  return {
    id: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === player
          ? { ...p, hand: seat.hand.filter((id) => id !== given.id), playArea: [...seat.playArea, given.id] }
          : p,
      ),
      instances: {
        ...given.state.instances,
        [given.id]: { ...mustInstance(given.state, given.id), controllerId: player, faceup: true },
      },
    },
  };
}

/** Takes the first copy of an encounter card out of the active encounter deck. */
function takeFromEncounterDeck(state: GameState, card: CardId): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId];
  const id = piles?.deck.find((candidate) => state.instances[candidate]?.cardId === card);
  if (!piles || !id) throw new Error(`no ${card} in the encounter deck`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
    },
  };
}

/** A minion from the encounter deck, engaged with `player` (surgery: no reveal, no When Revealed). */
export function minionEngagedWith(
  state: GameState,
  card: CardId,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const taken = takeFromEncounterDeck(state, card);
  const seat = mustPlayer(taken.state, player);
  return {
    id: taken.id,
    state: {
      ...taken.state,
      players: taken.state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...seat.playArea, taken.id] } : p,
      ),
      instances: {
        ...taken.state.instances,
        [taken.id]: { ...mustInstance(taken.state, taken.id), engagedWith: player, controllerId: null, faceup: true },
      },
    },
  };
}

/** A side scheme or environment from the encounter deck, in the villain's area with `threat` on it (surgery). */
export function encounterCardInVillainArea(
  state: GameState,
  card: CardId,
  threat = 0,
): { readonly state: GameState; readonly id: InstanceId } {
  const taken = takeFromEncounterDeck(state, card);
  return {
    id: taken.id,
    state: {
      ...taken.state,
      villainArea: [...taken.state.villainArea, taken.id],
      instances: {
        ...taken.state.instances,
        [taken.id]: { ...mustInstance(taken.state, taken.id), threat, faceup: true },
      },
    },
  };
}

/** Puts `card` on top of the active encounter deck (surgery), so the next draw from it is that card. */
export function onTopOfEncounterDeck(state: GameState, card: CardId): GameState {
  const taken = takeFromEncounterDeck(state, card);
  const deckId = activeEncounterDeckId(taken.state);
  const piles = taken.state.encounterDecks[deckId]!;
  return {
    ...taken.state,
    encounterDecks: { ...taken.state.encounterDecks, [deckId]: { ...piles, deck: [taken.id, ...piles.deck] } },
  };
}
