/**
 * Team-Ups on the Board, as plain data (the Gambit and Rogue picture, generically).
 *
 * A Team-Up is **active** when both characters a `teamUp` keyword names are in play, the condition the engine's own
 * play check enforces (`teamUpFault` in `engine/src/actions.ts`; RRG 1.8 "Team-Up", p. 43): a friendly character in
 * play whose title or subtitle matches each name, an identity (any seat's, by the face showing) or an ally a player
 * controls. This module asks the engine's `characterTitledAs` for each match rather than reading titles itself, so
 * the Board's badge and the engine's "can I play this card?" cannot disagree.
 *
 * Which pairs exist is read from the card pool (every `teamUp` keyword's `names`), never listed here, and only the
 * pairs a game could actually use matter: a pair is **relevant** when one of its names is a seated identity or a card
 * in a seated player's deck. The scene draws a badge for each active pair that has art, and a splash the first time
 * a pair is active, both off this model alone.
 */
import {
  categoriesOf,
  cardOf,
  characterTitledAs,
  controllerOf,
  identityCardTitledAs,
  playerOrder,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import type { AnyCard } from "@mc/content";
import { teamUpSlug } from "../art/team-up-art.js";

export interface TeamUpPair {
  /** The two names exactly as the keyword prints them. */
  readonly names: readonly [string, string];
  /** `teamUpSlug(names)`: the art folder and this pair's identity everywhere else. */
  readonly key: string;
  /** "Gambit and Rogue". */
  readonly label: string;
}

/** Every distinct pair named by a `teamUp` keyword on `cards`, in the order first met. */
export function teamUpPairsOf(cards: Iterable<AnyCard>): readonly TeamUpPair[] {
  const pairs = new Map<string, TeamUpPair>();
  for (const card of cards) {
    if (!("keywords" in card)) continue;
    for (const keyword of card.keywords) {
      if (keyword.name !== "teamUp" || !keyword.names) continue;
      const names = keyword.names;
      const key = teamUpSlug(names);
      if (!pairs.has(key)) pairs.set(key, { names, key, label: `${names[0]} and ${names[1]}` });
    }
  }
  return [...pairs.values()];
}

/** Whether `name` is a seated hero (an identity card in the game) or a card in a seated player's deck. */
function nameInGame(game: GameState, name: string): boolean {
  for (const player of game.players) {
    const identity = cardOf(game, player.identity.instanceId);
    if (identity?.type === "hero_identity" && identityCardTitledAs(identity, name)) return true;
  }
  for (const instance of Object.values(game.instances)) {
    if (instance.ownerId === null) continue;
    const card = cardOf(game, instance.instanceId);
    if (!card) continue;
    if (card.name === name || ("subtitle" in card && card.subtitle === name)) return true;
  }
  return false;
}

/** The friendly characters in play: every seated identity, and the allies players control (never a captive's). */
function friendlyCharacters(game: GameState): readonly InstanceId[] {
  return playerOrder(game).flatMap((player) => [
    player.identity.instanceId,
    ...player.playArea.filter((id) => categoriesOf(game, id).includes("ally") && controllerOf(game, id) !== null),
  ]);
}

/** The pairs from `pairs` that are relevant to this game and have both named characters in play right now. */
export function activeTeamUps(game: GameState, pairs: readonly TeamUpPair[]): readonly TeamUpPair[] {
  const friendly = friendlyCharacters(game);
  return pairs.filter(
    (pair) =>
      pair.names.some((name) => nameInGame(game, name)) &&
      pair.names.every((name) => friendly.some((id) => characterTitledAs(game, id, name))),
  );
}

/** What the scene remembers between states: the pairs (by key) that have already had their splash. */
export interface TeamUpWatch {
  readonly shown: ReadonlySet<string>;
}

export interface TeamUpObservation {
  readonly watch: TeamUpWatch;
  /** Pairs to show a splash for now, in the order given. Empty on almost every state. */
  readonly announce: readonly TeamUpPair[];
}

/**
 * Folds one state's active pairs into the watch.
 *
 * A pair gets its splash **once per game**: the first state in which it is active and has not been shown. Leaving play
 * and coming back brings the badge back but never the splash again (a Rogue ally defeated and replayed would otherwise
 * interrupt every time). Back out does the same, because `shown` is not rewound with the game.
 *
 * `previous` is null on the Board's first state of a game. A game that was **resumed** (the store's `version` is
 * ahead of its own `commandTrail`) has nowhere to record what was shown before the save, so a pair already active at
 * load counts as already seen. A fresh game's first state has no earlier state, so its pairs are announced.
 */
export function observeTeamUps(
  previous: TeamUpWatch | null,
  active: readonly TeamUpPair[],
  options: { readonly resumed: boolean },
): TeamUpObservation {
  const shown = new Set(previous?.shown ?? []);
  const announce = options.resumed && previous === null ? [] : active.filter((pair) => !shown.has(pair.key));
  for (const pair of active) shown.add(pair.key);
  return { watch: { shown }, announce };
}

/** The store's own signal that this game was loaded rather than started: commands ran before this store saw it. */
export function resumedGame(state: { readonly version: number; readonly commandTrail: readonly unknown[] }): boolean {
  return state.version > state.commandTrail.length;
}

/** The line of rule the panel opens with (RRG 1.8 "Team-Up", p. 43). */
export const TEAM_UP_RULE =
  "Team-Up cards naming both characters can be played while both are in play (RRG 1.8 p. 43).";

export interface TeamUpProvider {
  readonly name: string;
  /** "Player 1's hero", "Player 2's ally", or "not in play". */
  readonly by: string;
}

export interface TeamUpCardRow {
  /** A card id to open in Inspect (the first printing found). */
  readonly cardId: string;
  readonly name: string;
  readonly cost: string;
  readonly text: string;
  /** "in Gambit's deck: 1", one per seated deck holding copies, or "none in this game's decks". */
  readonly copies: readonly string[];
}

export interface TeamUpDetail {
  readonly title: string;
  readonly rule: string;
  readonly providers: readonly TeamUpProvider[];
  readonly cards: readonly TeamUpCardRow[];
}

/** Who is providing a character of the pair right now, by the same match the engine's play check makes. */
function providerOf(game: GameState, name: string, seatName: (id: PlayerId) => string): TeamUpProvider {
  for (const player of playerOrder(game)) {
    if (characterTitledAs(game, player.identity.instanceId, name)) {
      return { name, by: `${seatName(player.playerId)}'s ${player.identity.form === "hero" ? "hero" : "alter-ego"}` };
    }
  }
  for (const player of playerOrder(game)) {
    for (const id of player.playArea) {
      if (
        categoriesOf(game, id).includes("ally") &&
        controllerOf(game, id) !== null &&
        characterTitledAs(game, id, name)
      )
        return { name, by: `${seatName(player.playerId)}'s ally` };
    }
  }
  return { name, by: "not in play" };
}

/**
 * The seats that provide one of `pair`'s characters right now: whose identity (by the face showing) or whose
 * controlled ally matches either name. One entry per seat however many of the pair it provides, in player order.
 */
export function teamUpProviders(game: GameState, pair: TeamUpPair): readonly PlayerId[] {
  return playerOrder(game)
    .filter(
      (player) =>
        pair.names.some((name) => characterTitledAs(game, player.identity.instanceId, name)) ||
        player.playArea.some(
          (id) =>
            categoriesOf(game, id).includes("ally") &&
            controllerOf(game, id) !== null &&
            pair.names.some((name) => characterTitledAs(game, id, name)),
        ),
    )
    .map((player) => player.playerId);
}

/**
 * What the Team-Up panel shows for `pair`: the rule, who provides each character, and every Team-Up card naming
 * exactly this pair (one row per card name across packs) with its printed cost and current text. Copies are counted
 * from each seated player's decklist, never by zone, so nothing about a hand or a deck's order is given away.
 */
export function teamUpDetail(
  game: GameState,
  pair: TeamUpPair,
  cards: Iterable<AnyCard>,
  seatName: (id: PlayerId) => string,
): TeamUpDetail {
  const byName = new Map<string, AnyCard>();
  for (const card of cards) {
    if (!("keywords" in card)) continue;
    const named = card.keywords.some((k) => k.name === "teamUp" && k.names && teamUpSlug(k.names) === pair.key);
    if (named && !byName.has(card.name)) byName.set(card.name, card);
  }
  const rows: TeamUpCardRow[] = [...byName.values()].map((card) => {
    const copies = playerOrder(game).flatMap((player) => {
      const count = Object.values(game.instances).filter(
        (instance) => instance.ownerId === player.playerId && cardOf(game, instance.instanceId)?.name === card.name,
      ).length;
      if (count === 0) return [];
      const hero = cardOf(game, player.identity.instanceId)?.name ?? seatName(player.playerId);
      return [`in ${hero}'s deck: ${count}`];
    });
    return {
      cardId: card.id as string,
      name: card.name,
      cost: "cost" in card && card.cost !== null && card.cost !== undefined ? String(card.cost) : "no cost",
      text: "text" in card ? card.text.current : "",
      copies: copies.length > 0 ? copies : ["none in this game's decks"],
    };
  });
  return {
    title: `Team-Up: ${pair.label}`,
    rule: TEAM_UP_RULE,
    providers: pair.names.map((name) => providerOf(game, name, seatName)),
    cards: rows,
  };
}
