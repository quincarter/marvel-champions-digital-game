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

const pairsByPool = new WeakMap<object, readonly TeamUpPair[]>();

/** Every Team-Up pair the game's own card pool names, derived once per pool. */
export function poolTeamUpPairs(game: GameState): readonly TeamUpPair[] {
  let pairs = pairsByPool.get(game.cardPool);
  if (!pairs) {
    pairs = teamUpPairsOf(Object.values(game.cardPool));
    pairsByPool.set(game.cardPool, pairs);
  }
  return pairs;
}

/** "Player 2": the seat's place at the table, which is how a Team-Up line names who provides a character. */
export function seatLabel(game: GameState, id: PlayerId): string {
  return `Player ${game.players.findIndex((p) => p.playerId === id) + 1}`;
}

/** The pair a Team-Up keyword names, or null for a card with none (or one with its names missing from card data). */
function pairOfCard(card: AnyCard): TeamUpPair | null {
  return "keywords" in card ? (teamUpPairsOf([card])[0] ?? null) : null;
}

/** Whether a character card is named by `name` the way the engine matches a character in play: title or subtitle. */
function cardNamed(card: AnyCard, name: string): boolean {
  return card.name === name || ("subtitle" in card && card.subtitle === name);
}

/**
 * What a card in hand has to do with Team-Up, for the tag on it and its Inspect notice:
 * - `teamUpCard`: it carries the keyword; `active` says whether both characters are in play (the engine's own test).
 * - `completesPair`: an ally named by one of a pair's two names, not in play yet, whose partner IS in play, so
 *   playing it makes the Team-Up active.
 * - `needsPartner`: the same ally with the partner absent; playing it would not complete the pair.
 * Null for everything else, including an ally already in play (its ring says it).
 */
export type TeamUpRole =
  | { readonly kind: "teamUpCard"; readonly pair: TeamUpPair; readonly active: boolean }
  | { readonly kind: "completesPair"; readonly pair: TeamUpPair; readonly name: string; readonly partner: string }
  | { readonly kind: "needsPartner"; readonly pair: TeamUpPair; readonly name: string; readonly partner: string };

export function teamUpRoleOf(game: GameState, id: InstanceId, pairs: readonly TeamUpPair[]): TeamUpRole | null {
  const card = cardOf(game, id);
  if (!card) return null;
  const own = pairOfCard(card);
  if (own) return { kind: "teamUpCard", pair: own, active: activeTeamUps(game, [own]).length > 0 };
  if (card.type !== "ally") return null;
  if (game.players.some((player) => player.playArea.includes(id))) return null;
  const friendly = friendlyCharacters(game);
  const inPlay = (name: string): boolean => friendly.some((other) => characterTitledAs(game, other, name));
  for (const pair of pairs) {
    const index = pair.names.findIndex((name) => cardNamed(card, name));
    if (index < 0) continue;
    const name = pair.names[index]!;
    const partner = pair.names[1 - index]!;
    if (inPlay(name)) continue;
    return inPlay(partner)
      ? { kind: "completesPair", pair, name, partner }
      : { kind: "needsPartner", pair, name, partner };
  }
  return null;
}

export interface TeamUpTag {
  readonly text: string;
  /** Full accent when the engine says the card can be played now; a quieter outline when it cannot. */
  readonly go: boolean;
}

/** The tag a hand card carries, or null: only a Team-Up card with its pair active, or an ally that completes one. */
export function teamUpTagFor(role: TeamUpRole | null, playable: boolean): TeamUpTag | null {
  if (!role) return null;
  if (role.kind === "teamUpCard" ? !role.active : role.kind === "needsPartner") return null;
  return { text: playable ? "▶ Team-Up" : "Team-Up", go: playable };
}

export interface TeamUpNotice {
  /** `active` and `completes` draw in the accent color; `needs` and `waiting` are quiet. */
  readonly kind: "active" | "completes" | "needs" | "waiting";
  readonly heading: string;
  readonly text: string;
  readonly lines: readonly string[];
}

const missingNames = (game: GameState, pair: TeamUpPair): readonly string[] => {
  const friendly = friendlyCharacters(game);
  return pair.names.filter((name) => !friendly.some((id) => characterTitledAs(game, id, name)));
};

/**
 * The attention callout at the top of Inspect's RULES & STATE panel for a Team-Up card or a character that would
 * complete a pair. `game` null is a sheet with no game behind it (deck builder, glossary): only the neutral rule line.
 */
export function teamUpNoticeFor(
  game: GameState | null,
  card: AnyCard,
  id: InstanceId | null,
  pairs: readonly TeamUpPair[],
): TeamUpNotice | null {
  const own = pairOfCard(card);
  if (!game || !id) {
    return own
      ? { kind: "needs", heading: "Team-Up", text: `Team-Up: needs ${own.label} both in play.`, lines: [] }
      : null;
  }
  const role = teamUpRoleOf(game, id, pairs);
  if (!role) return null;
  if (role.kind === "teamUpCard") {
    if (role.active) {
      const providers = teamUpDetail(game, role.pair, [], (seat) => seatLabel(game, seat)).providers;
      return {
        kind: "active",
        heading: "Team-Up",
        text: `Team-Up active: ${role.pair.label} are both in play, so this card can be played.`,
        lines: providers.map((p) => `${p.name}: ${p.by}.`),
      };
    }
    const missing = missingNames(game, role.pair);
    return {
      kind: "needs",
      heading: "Team-Up",
      text: `Team-Up: needs ${role.pair.label} both in play. Missing: ${missing.join(" and ")}.`,
      lines: [],
    };
  }
  if (role.kind === "needsPartner") {
    return {
      kind: "waiting",
      heading: "Team-Up",
      text: `Team-Up with ${role.partner}: needs both in play.`,
      lines: [],
    };
  }
  const detail = teamUpDetail(game, role.pair, Object.values(game.cardPool), (seat) => seatLabel(game, seat));
  const cards = detail.cards.map((row) => `${row.name} (${row.copies.join("; ")})`);
  return {
    kind: "completes",
    heading: "Team-Up",
    text:
      `Team-Up: playing ${role.name} brings ${role.pair.label} together.` +
      (cards.length > 0 ? ` Team-Up cards for this pair: ${cards.join(", ")}.` : ""),
    lines: [],
  };
}
