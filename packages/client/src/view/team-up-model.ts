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

/**
 * Whether the friendly character `id` is `name` in ANY form: an identity by any of its titles (hero faces, alter-ego
 * face, the card's own name; `identityCardTitledAs`, the deckbuilding match), anything else as the engine matches it.
 * This is the client's "present" test; the engine's play rule (`characterTitledAs`, the face showing) is "playable".
 */
function characterPresentAs(game: GameState, id: InstanceId, name: string): boolean {
  if (game.players.some((player) => player.identity.instanceId === id)) {
    const card = cardOf(game, id);
    return card?.type === "hero_identity" && identityCardTitledAs(card, name);
  }
  return characterTitledAs(game, id, name);
}

/** A pair that is relevant to this game with both characters in play, and whether the engine lets its cards be played. */
export interface TeamUpState {
  readonly pair: TeamUpPair;
  /** The engine's own condition: both characters showing the title the keyword names (an identity's hero side up). */
  readonly playable: boolean;
}

/**
 * The pairs from `pairs` that are relevant to this game and have both named characters **present**: in play in any form
 * (an identity counts whichever side is up). `playable` is the engine's play check for the pair (RRG 1.8 "Team-Up",
 * p. 43: both showing). The Board draws a ring for every present pair, quiet while it is not playable.
 */
export function presentTeamUps(game: GameState, pairs: readonly TeamUpPair[]): readonly TeamUpState[] {
  const friendly = friendlyCharacters(game);
  return pairs.flatMap((pair) => {
    if (!pair.names.some((name) => nameInGame(game, name))) return [];
    if (!pair.names.every((name) => friendly.some((id) => characterPresentAs(game, id, name)))) return [];
    const playable = pair.names.every((name) => friendly.some((id) => characterTitledAs(game, id, name)));
    return [{ pair, playable }];
  });
}

/** The ring's hover label: "Team-Up active: ..." when playable, else just the pair (the blurb on the hero says why not). */
export function ringLabel(badge: { readonly label: string; readonly playable: boolean }): string {
  return badge.playable ? `Team-Up active: ${badge.label}` : `Team-Up: ${badge.label}`;
}

/** What the yellow blurb on a character that holds a present Team-Up up says. */
export const TEAM_UP_BLURB = "Team-Up: needs hero form";

/**
 * The seats that hold a present pair up: for each present pair that is not playable, the seats whose identity is one
 * of its characters but is showing the other side (an alter-ego up). Each gets the yellow "needs hero form" blurb on
 * its panel; an ally provider never does (allies have no form), and nor does a seat that is not part of the pair.
 */
export function teamUpWaitingSeats(game: GameState, states: readonly TeamUpState[]): ReadonlySet<PlayerId> {
  const seats = new Set<PlayerId>();
  for (const { pair, playable } of states) {
    if (playable) continue;
    for (const player of playerOrder(game)) {
      const id = player.identity.instanceId;
      if (pair.names.some((name) => characterPresentAs(game, id, name) && !characterTitledAs(game, id, name))) {
        seats.add(player.playerId);
      }
    }
  }
  return seats;
}

/** The pairs from `pairs` that are relevant to this game and have both named characters showing right now (playable). */
export function activeTeamUps(game: GameState, pairs: readonly TeamUpPair[]): readonly TeamUpPair[] {
  return presentTeamUps(game, pairs)
    .filter((state) => state.playable)
    .map((state) => state.pair);
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
 * A pair gets its splash **once per game**: the first state in which it is present (in play in any form; callers pass
 * `presentTeamUps`' pairs) and has not been shown, so it does not show again when the pair later becomes playable.
 * Leaving play
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
  /**
   * "Player 1's hero, in hero form", "Player 2's hero, in alter-ego form (Kitty Pryde)", "Player 2's ally", or
   * "not in play".
   */
  readonly by: string;
  /** The character is in play and showing the title the keyword names (the engine's test). */
  readonly showing: boolean;
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
  /** Whether Team-Up cards for this pair can be played now (the engine's form condition). */
  readonly playable: boolean;
  /** One line: "Team-Up cards can be played now." or "Team-Up cards need Shadowcat in hero form." */
  readonly status: string;
  readonly providers: readonly TeamUpProvider[];
  readonly cards: readonly TeamUpCardRow[];
}

/** Who is providing a character of the pair right now, in any form (see `characterPresentAs`), and the form showing. */
function providerOf(game: GameState, name: string, seatName: (id: PlayerId) => string): TeamUpProvider {
  for (const player of playerOrder(game)) {
    const id = player.identity.instanceId;
    if (!characterPresentAs(game, id, name)) continue;
    const identity = cardOf(game, id);
    const alterEgo = identity?.type === "hero_identity" ? identity.alterEgo.faceName : "";
    const form =
      player.identity.form === "hero" ? "in hero form" : `in alter-ego form${alterEgo ? ` (${alterEgo})` : ""}`;
    return { name, by: `${seatName(player.playerId)}'s hero, ${form}`, showing: characterTitledAs(game, id, name) };
  }
  for (const player of playerOrder(game)) {
    for (const id of player.playArea) {
      if (
        categoriesOf(game, id).includes("ally") &&
        controllerOf(game, id) !== null &&
        characterTitledAs(game, id, name)
      )
        return { name, by: `${seatName(player.playerId)}'s ally`, showing: true };
    }
  }
  return { name, by: "not in play", showing: false };
}

/** The panel's one-line status for a pair: playable now, or which characters still need the hero side (or play). */
export function teamUpStatus(providers: readonly TeamUpProvider[]): { playable: boolean; text: string } {
  const waiting = providers.filter((p) => !p.showing);
  if (waiting.length === 0) return { playable: true, text: "Team-Up cards can be played now." };
  const absent = waiting.filter((p) => p.by === "not in play").map((p) => p.name);
  const wrongForm = waiting.filter((p) => p.by !== "not in play").map((p) => p.name);
  const parts = [
    ...(wrongForm.length > 0 ? [`${wrongForm.join(" and ")} in hero form`] : []),
    ...(absent.length > 0 ? [`${absent.join(" and ")} in play`] : []),
  ];
  return { playable: false, text: `Team-Up cards need ${parts.join(" and ")}.` };
}

/**
 * The seats that provide one of `pair`'s characters right now: whose identity (by the face showing) or whose
 * controlled ally matches either name. One entry per seat however many of the pair it provides, in player order.
 */
export function teamUpProviders(game: GameState, pair: TeamUpPair): readonly PlayerId[] {
  return playerOrder(game)
    .filter(
      (player) =>
        pair.names.some((name) => characterPresentAs(game, player.identity.instanceId, name)) ||
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
  const providers = pair.names.map((name) => providerOf(game, name, seatName));
  const status = teamUpStatus(providers);
  return {
    title: `Team-Up: ${pair.label}`,
    rule: TEAM_UP_RULE,
    playable: status.playable,
    status: status.text,
    providers,
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
  | {
      readonly kind: "teamUpCard";
      readonly pair: TeamUpPair;
      /** Both characters showing the hero side: the engine's own test. */
      readonly active: boolean;
      /** Both in play in any form; `present && !active` means a form is still wrong. */
      readonly present: boolean;
    }
  | { readonly kind: "completesPair"; readonly pair: TeamUpPair; readonly name: string; readonly partner: string }
  | { readonly kind: "needsPartner"; readonly pair: TeamUpPair; readonly name: string; readonly partner: string };

export function teamUpRoleOf(game: GameState, id: InstanceId, pairs: readonly TeamUpPair[]): TeamUpRole | null {
  const card = cardOf(game, id);
  if (!card) return null;
  const own = pairOfCard(card);
  if (own) {
    const [state] = presentTeamUps(game, [own]);
    return { kind: "teamUpCard", pair: own, active: state?.playable ?? false, present: state !== undefined };
  }
  if (card.type !== "ally") return null;
  if (game.players.some((player) => player.playArea.includes(id))) return null;
  const friendly = friendlyCharacters(game);
  const inPlay = (name: string): boolean => friendly.some((other) => characterPresentAs(game, other, name));
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

/**
 * The tag a hand card carries, or null: a Team-Up card with its pair present (full when the engine says it can be
 * played, quiet when not, whether a form or something else is in the way), or an ally that completes one.
 */
export function teamUpTagFor(role: TeamUpRole | null, playable: boolean): TeamUpTag | null {
  if (!role) return null;
  if (role.kind === "teamUpCard" ? !role.present : role.kind === "needsPartner") return null;
  return { text: playable ? "▶ Team-Up" : "Team-Up", go: playable };
}

export interface TeamUpNotice {
  /** `active` and `completes` draw in the accent color; `needs` and `waiting` are quiet. */
  readonly kind: "active" | "completes" | "needs" | "waiting";
  readonly heading: string;
  readonly text: string;
  readonly lines: readonly string[];
}

/** The names of `pair` with no friendly character in play in any form. */
const absentNames = (game: GameState, pair: TeamUpPair): readonly string[] => {
  const friendly = friendlyCharacters(game);
  return pair.names.filter((name) => !friendly.some((id) => characterPresentAs(game, id, name)));
};

/** The names of `pair` in play but not showing the title the keyword names (an identity on its other side). */
export const teamUpMissingForm = (game: GameState, pair: TeamUpPair): readonly string[] => {
  const friendly = friendlyCharacters(game);
  return pair.names.filter(
    (name) =>
      friendly.some((id) => characterPresentAs(game, id, name)) &&
      !friendly.some((id) => characterTitledAs(game, id, name)),
  );
};

/**
 * The engine's why-not for a Team-Up card ("Team-Up needs Shadowcat in play"), reworded when the character IS in play
 * on her alter-ego side: the client says "needs Shadowcat in hero form" rather than something that reads as false.
 * Any other message, or a card whose pair is not present, comes back untouched.
 */
export function teamUpWhyNot(game: GameState, id: InstanceId, message: string): string {
  if (!/^team-up needs/i.test(message)) return message;
  const role = teamUpRoleOf(game, id, poolTeamUpPairs(game));
  if (role?.kind !== "teamUpCard" || !role.present || role.active) return message;
  return `Team-Up needs ${teamUpMissingForm(game, role.pair).join(" and ")} in hero form`;
}

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
    // Present but not playable: the engine's why-not says "needs X in play", which misleads when X IS in play on its
    // alter-ego side, so the client says what is actually missing.
    if (role.present) {
      return {
        kind: "needs",
        heading: "Team-Up",
        text: `Team-Up: needs ${teamUpMissingForm(game, role.pair).join(" and ")} in hero form.`,
        lines: [],
      };
    }
    const missing = absentNames(game, role.pair);
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
