/**
 * Your stats in deck building: what the player's finished games say about one hero's cards, for the "From your games"
 * tab of the deck builder's rail and of the Decks screen's stats pane (`fromYourGamesOf`).
 *
 * Folded from the saved games' rows, like the Stats screen (`player-stats-model.ts`), and by the same rules: a game that
 * finished as a win or a loss counts, a guided game does not, and card numbers come only from games whose summary has
 * per-seat card counts (`SeatSummary`). A seat is matched to its deck through the game's config, seat for seat
 * (`config.players[i]` is `summary.seats[i]`): a precon by its starter deck id, a saved deck by its deck id.
 *
 * Suggestions only. Nothing here changes a deck: the screens show these lists and the player presses Cut or Add.
 *
 * Pure: names come in through `StatsNames`.
 */
import type { CorePlayer } from "@mc/cards";
import type { SaveMeta } from "../engine/game-storage.js";
import type { SeatSummary } from "../engine/game-summary.js";
import type { StatsNames } from "./player-stats-model.js";

/** A deck's record key, the one `view/results-history.ts` uses (`deckKeyToString`). */
export type DeckKeyString = string;

interface Tally {
  games: number;
  wins: number;
  losses: number;
  lostToScheme: number;
  lostToWipe: number;
}

/** One hero's games and what their cards did in them (only games with card counts). */
export interface HeroUsage extends Readonly<Tally> {
  /** Games with card counts. */
  readonly tracked: number;
  /** Card id to the games it was in the deck for. */
  readonly inDeck: Readonly<Record<string, number>>;
  /** Card id to the games it was played or came into play. */
  readonly usedIn: Readonly<Record<string, number>>;
  /** Card id to the won games it was played or came into play. */
  readonly wonWith: Readonly<Record<string, number>>;
  readonly damage: number;
  readonly thwart: number;
}

/** One deck's games and what its cards did in them. */
export type DeckPlay = HeroUsage;

export interface DeckInsights {
  readonly heroes: Readonly<Record<string, HeroUsage>>;
  readonly decks: Readonly<Record<DeckKeyString, DeckPlay>>;
}

const blank = (): {
  games: number;
  wins: number;
  losses: number;
  lostToScheme: number;
  lostToWipe: number;
  tracked: number;
  inDeck: Record<string, number>;
  usedIn: Record<string, number>;
  wonWith: Record<string, number>;
  damage: number;
  thwart: number;
} => ({
  games: 0,
  wins: 0,
  losses: 0,
  lostToScheme: 0,
  lostToWipe: 0,
  tracked: 0,
  inDeck: {},
  usedIn: {},
  wonWith: {},
  damage: 0,
  thwart: 0,
});

type Mutable = ReturnType<typeof blank>;

const bump = (counts: Record<string, number>, id: string): void => {
  counts[id] = (counts[id] ?? 0) + 1;
};

/** The deck key of a seat's config, or null for a saved deck seat from before decks carried ids. */
export function deckKeyOfPlayer(player: CorePlayer): DeckKeyString | null {
  if ("starterDeckId" in player) return `starter:${player.starterDeckId}`;
  return player.deckId ? `custom:${player.deckId}` : null;
}

function addGame(into: Mutable, won: boolean, lossReason: string | null, seat: SeatSummary | null): void {
  into.games++;
  if (won) into.wins++;
  else {
    into.losses++;
    if (lossReason === "schemeCompleted") into.lostToScheme++;
    if (lossReason === "playersDefeated") into.lostToWipe++;
  }
  if (!seat) return;
  into.tracked++;
  into.damage += seat.damage;
  into.thwart += seat.thwart;
  for (const id of seat.deck) bump(into.inDeck, id);
  for (const id of new Set([...Object.keys(seat.plays), ...Object.keys(seat.entered ?? {})])) {
    bump(into.usedIn, id);
    if (won) bump(into.wonWith, id);
  }
}

/** Every hero's and every deck's games, from the saved games' rows. */
export function deckInsightsOf(saves: readonly SaveMeta[], names: StatsNames): DeckInsights {
  const heroes: Record<string, Mutable> = {};
  const decks: Record<string, Mutable> = {};
  for (const meta of saves) {
    if (meta.guided || (meta.status !== "won" && meta.status !== "lost")) continue;
    const won = meta.status === "won";
    const summary = meta.summary ?? null;
    const lossReason =
      summary?.lossReason ??
      (won
        ? null
        : meta.outcome?.reason === "mainSchemeCompleted"
          ? "schemeCompleted"
          : meta.outcome?.reason === "allPlayersDefeated"
            ? "playersDefeated"
            : "other");
    meta.config.players.forEach((player, index) => {
      const seat = summary?.seats?.[index] ?? null;
      if (seat?.satOut) return;
      const identity =
        seat?.identityCardId ??
        ("starterDeckId" in player ? names.starterDeck(player.starterDeckId)?.identityCardId : player.identityCardId);
      if (identity) addGame((heroes[identity] ??= blank()), won, lossReason, seat);
      const key = deckKeyOfPlayer(player);
      if (key) addGame((decks[key] ??= blank()), won, lossReason, seat);
    });
  }
  return { heroes, decks };
}

/** Player card types the lists name: ones played from hand. Resources are meant to be spent, not played. */
const PLAYED_TYPES: ReadonlySet<string> = new Set(["ally", "event", "support", "upgrade"]);
const LIST = 3;

export interface SuggestedCard {
  readonly cardId: string;
  readonly detail: string;
}

export interface FromYourGames {
  /** "Spider-Man · 7 games · 5–2", or null with no games for this hero. */
  readonly headline: string | null;
  /** One line on how this hero's games go, or null with too little to say. */
  readonly insight: string | null;
  /** Cards in this deck that rarely come out in your games. */
  readonly cut: readonly SuggestedCard[];
  /** Cards you have won with on this hero that this deck does not have, and that it could take. */
  readonly tryCards: readonly SuggestedCard[];
  /** Cards in this deck that come out in most of your games. */
  readonly keep: readonly SuggestedCard[];
  /** Why the lists are empty, or null. */
  readonly note: string | null;
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * The deck builder's "From your games" tab for the deck being built: `identityCardId`'s games, against the cards in
 * the deck now (`deckCards`) and its aspects. A card is offered to try only when this deck may take it: a basic card,
 * one of the deck's aspects, or the hero's own.
 */
export function fromYourGamesOf(
  insights: DeckInsights,
  identityCardId: string,
  deckCards: readonly string[],
  aspects: readonly string[],
  names: StatsNames,
): FromYourGames {
  const usage = insights.heroes[identityCardId];
  const heroName = (names.cardName(identityCardId) ?? identityCardId).replace(/ \(.*\)$/, "");
  if (!usage || usage.games === 0) {
    return {
      headline: null,
      insight: null,
      cut: [],
      tryCards: [],
      keep: [],
      note: `Play ${heroName} and finish a game: what you play shows up here.`,
    };
  }
  const headline = `${heroName} · ${plural(usage.games, "game")} · ${usage.wins}–${usage.losses}`;
  const parts: string[] = [];
  if (usage.losses > 0) {
    if (usage.lostToScheme > usage.lostToWipe) {
      parts.push(`${usage.lostToScheme} of ${plural(usage.losses, "loss", "losses")} came from the main scheme.`);
    } else if (usage.lostToWipe > 0) {
      parts.push(`${usage.lostToWipe} of ${plural(usage.losses, "loss", "losses")} came from every hero falling.`);
    }
  }
  if (usage.tracked > 0) {
    parts.push(
      `You remove ${(usage.thwart / usage.tracked).toFixed(1)} threat and deal ${(usage.damage / usage.tracked).toFixed(1)} damage a game.`,
    );
  }
  if (usage.tracked === 0) {
    return {
      headline,
      insight: parts.join(" ") || null,
      cut: [],
      tryCards: [],
      keep: [],
      note: "Card suggestions start with the next game you finish with this hero.",
    };
  }
  const inDeckNow = new Set(deckCards);
  const played = (id: string): boolean => PLAYED_TYPES.has(names.cardType(id) ?? "");
  const rate = (id: string): number => (usage.usedIn[id] ?? 0) / (usage.inDeck[id] ?? 1);
  const nameOf = (id: string): string => names.cardName(id) ?? id;
  const mine = [...inDeckNow].filter((id) => played(id) && (usage.inDeck[id] ?? 0) >= 2);
  // The hero's own cards are never offered to cut: a deck must include each of them (RRG 1.8 Appendix I, "Deck
  // Customization", p. 50).
  const required = (id: string): boolean => names.cardAspect(id) === `hero:${identityCardId}`;
  const cut = mine
    .filter((id) => rate(id) < 0.25 && !required(id))
    .sort(
      (a, b) =>
        rate(a) - rate(b) || (usage.inDeck[b] ?? 0) - (usage.inDeck[a] ?? 0) || nameOf(a).localeCompare(nameOf(b)),
    )
    .slice(0, LIST)
    .map((id) => {
      const used = usage.usedIn[id] ?? 0;
      const games = usage.inDeck[id] ?? 0;
      return {
        cardId: id,
        detail: used === 0 ? `Never played in ${plural(games, "game")}` : `Played in ${used} of ${games}`,
      };
    });
  const keep = mine
    .filter((id) => rate(id) >= 0.75)
    .sort((a, b) => (usage.usedIn[b] ?? 0) - (usage.usedIn[a] ?? 0) || nameOf(a).localeCompare(nameOf(b)))
    .slice(0, 4)
    .map((id) => ({ cardId: id, detail: `Played in ${usage.usedIn[id]} of ${usage.inDeck[id]}` }));
  const takes = (id: string): boolean => {
    const aspect = names.cardAspect(id) ?? "";
    return aspect === "basic" || aspects.includes(aspect) || aspect === `hero:${identityCardId}`;
  };
  const tryCards = Object.entries(usage.wonWith)
    .filter(([id]) => !inDeckNow.has(id) && played(id) && takes(id))
    .sort(([a, x], [b, y]) => y - x || nameOf(a).localeCompare(nameOf(b)))
    .slice(0, LIST)
    .map(([id, n]) => ({ cardId: id, detail: `In ${plural(n, "win")} with ${heroName}` }));
  const empty = cut.length === 0 && tryCards.length === 0 && keep.length === 0;
  return {
    headline,
    insight: parts.join(" ") || null,
    cut,
    tryCards,
    keep,
    note: empty ? "Nothing stands out yet: play a few more games with this deck." : null,
  };
}
