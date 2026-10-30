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
  /** Card id to times played (`SeatSummary.plays`), and to abilities used (`SeatSummary.activations`). */
  readonly plays: Readonly<Record<string, number>>;
  readonly activations: Readonly<Record<string, number>>;
}

/** One deck's games and what its cards did in them. */
export type DeckPlay = HeroUsage;

/**
 * The decks you brought against one villain (only games with card counts): a seat is one deck, so a two-hero win is two
 * winning decks. Every hero's together, since a card that beats a villain is worth knowing whoever played it.
 */
export interface VillainDecks {
  readonly wins: number;
  readonly losses: number;
  /** Card id to the winning decks it was in, and to the losing decks. */
  readonly inWins: Readonly<Record<string, number>>;
  readonly inLosses: Readonly<Record<string, number>>;
}

export interface DeckInsights {
  readonly heroes: Readonly<Record<string, HeroUsage>>;
  readonly decks: Readonly<Record<DeckKeyString, DeckPlay>>;
  /** By the villain's name as Your stats gives it. */
  readonly villains: Readonly<Record<string, VillainDecks>>;
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
  plays: Record<string, number>;
  activations: Record<string, number>;
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
  plays: {},
  activations: {},
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
  for (const [id, n] of Object.entries(seat.plays)) into.plays[id] = (into.plays[id] ?? 0) + n;
  for (const [id, n] of Object.entries(seat.activations)) into.activations[id] = (into.activations[id] ?? 0) + n;
  for (const id of new Set([...Object.keys(seat.plays), ...Object.keys(seat.entered ?? {})])) {
    bump(into.usedIn, id);
    if (won) bump(into.wonWith, id);
  }
}

/** Every hero's and every deck's games, from the saved games' rows. */
export function deckInsightsOf(saves: readonly SaveMeta[], names: StatsNames): DeckInsights {
  const heroes: Record<string, Mutable> = {};
  const decks: Record<string, Mutable> = {};
  const villains: Record<
    string,
    { wins: number; losses: number; inWins: Record<string, number>; inLosses: Record<string, number> }
  > = {};
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
    const villain = villainNameOf(meta, names);
    meta.config.players.forEach((player, index) => {
      const seat = summary?.seats?.[index] ?? null;
      if (seat?.satOut) return;
      const identity =
        seat?.identityCardId ??
        ("starterDeckId" in player ? names.starterDeck(player.starterDeckId)?.identityCardId : player.identityCardId);
      if (identity) addGame((heroes[identity] ??= blank()), won, lossReason, seat);
      const key = deckKeyOfPlayer(player);
      if (key) addGame((decks[key] ??= blank()), won, lossReason, seat);
      if (!seat) return;
      const against = (villains[villain] ??= { wins: 0, losses: 0, inWins: {}, inLosses: {} });
      if (won) against.wins++;
      else against.losses++;
      for (const id of seat.deck) bump(won ? against.inWins : against.inLosses, id);
    });
  }
  return { heroes, decks, villains };
}

/** Player card types the lists name: ones played from hand. Resources are meant to be spent, not played. */
const PLAYED_TYPES: ReadonlySet<string> = new Set(["ally", "event", "support", "upgrade"]);
const LIST = 3;
/** Decks faced before a villain's card lists show: one game says nothing about a card. */
const MIN_DECKS = 2;

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

/** The villain's name as Your stats gives it: the game's villains, else its scenario's name on an older save. */
export function villainNameOf(meta: SaveMeta, names: StatsNames): string {
  const villains = meta.summary?.villains;
  if (villains && villains.length > 0) return villains.join(" & ");
  return names.scenarioName(meta.config.scenarioId) ?? meta.config.scenarioId;
}

/** Whether this deck may take a card: a basic card, one of the deck's aspects, or the hero's own. */
const deckTakes = (id: string, identityCardId: string, aspects: readonly string[], names: StatsNames): boolean => {
  const aspect = names.cardAspect(id) ?? "";
  return aspect === "basic" || aspects.includes(aspect) || aspect === `hero:${identityCardId}`;
};

/** Every villain your decks have faced, most faced first: what the "Against" stepper walks. */
export function villainsFacedOf(insights: DeckInsights): readonly string[] {
  const decksOf = ({ wins, losses }: VillainDecks): number => wins + losses;
  return Object.entries(insights.villains)
    .sort(([a, x], [b, y]) => decksOf(y) - decksOf(x) || a.localeCompare(b))
    .map(([name]) => name);
}

export interface AgainstVillain {
  /** "Against Klaw · 4 wins, 2 losses", counting decks. */
  readonly headline: string;
  /** Cards this deck could take that lean to your winning decks here, and are not in it. */
  readonly tryCards: readonly SuggestedCard[];
  /** Cards in this deck that lean to your losing decks here. */
  readonly cutCards: readonly SuggestedCard[];
  /** Why the lists are empty, or null. */
  readonly note: string | null;
}

/**
 * The cards your winning decks against `villain` had and your losing ones did not, and the other way around, against the
 * deck being built. A card leans by the share of winning decks it was in less the share of losing decks. Suggestions only.
 */
export function againstVillainOf(
  insights: DeckInsights,
  villain: string,
  identityCardId: string,
  deckCards: readonly string[],
  aspects: readonly string[],
  names: StatsNames,
): AgainstVillain | null {
  const faced = insights.villains[villain];
  if (!faced) return null;
  const headline = `Against ${villain} · ${plural(faced.wins, "win")}, ${plural(faced.losses, "loss", "losses")}`;
  const nameOf = (id: string): string => names.cardName(id) ?? id;
  const lean = (id: string): number =>
    (faced.wins > 0 ? (faced.inWins[id] ?? 0) / faced.wins : 0) -
    (faced.losses > 0 ? (faced.inLosses[id] ?? 0) / faced.losses : 0);
  const detail = (id: string): string =>
    `In ${faced.inWins[id] ?? 0} of ${plural(faced.wins, "win")} · ${faced.inLosses[id] ?? 0} of ${plural(faced.losses, "loss", "losses")}`;
  const played = (id: string): boolean => PLAYED_TYPES.has(names.cardType(id) ?? "");
  if (faced.wins + faced.losses < MIN_DECKS)
    return {
      headline,
      tryCards: [],
      cutCards: [],
      note: "Nothing stands out yet: face this villain a few more times.",
    };
  const inDeckNow = new Set(deckCards);
  const tryCards = Object.keys(faced.inWins)
    .filter((id) => !inDeckNow.has(id) && played(id) && lean(id) > 0 && deckTakes(id, identityCardId, aspects, names))
    .sort((a, b) => lean(b) - lean(a) || nameOf(a).localeCompare(nameOf(b)))
    .slice(0, LIST)
    .map((id) => ({ cardId: id, detail: detail(id) }));
  // The hero's own cards are never offered to cut (`fromYourGamesOf`).
  const cutCards = [...inDeckNow]
    .filter((id) => (faced.inLosses[id] ?? 0) > 0 && played(id) && lean(id) < 0)
    .filter((id) => names.cardAspect(id) !== `hero:${identityCardId}`)
    .sort((a, b) => lean(a) - lean(b) || nameOf(a).localeCompare(nameOf(b)))
    .slice(0, LIST)
    .map((id) => ({ cardId: id, detail: detail(id) }));
  const empty = tryCards.length === 0 && cutCards.length === 0;
  return { headline, tryCards, cutCards, note: empty ? "No card stands out against this villain yet." : null };
}

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
  const tryCards = Object.entries(usage.wonWith)
    .filter(([id]) => !inDeckNow.has(id) && played(id) && deckTakes(id, identityCardId, aspects, names))
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

export interface CardPlayLine {
  readonly label: string;
  readonly value: string;
}

/**
 * One card's "Your play" (#529): the Decks screen's card pane and Inspect. With a hero, that hero's games only (the
 * card in a game, or in that hero's deck); without one, every hero's together. Null when the card was never in a deck
 * in a game with card numbers.
 */
export function cardPlayOf(
  insights: DeckInsights,
  cardId: string,
  identityCardId: string | null,
  names: StatsNames,
): readonly CardPlayLine[] | null {
  const heroes = identityCardId
    ? [[identityCardId, insights.heroes[identityCardId]] as const].filter(([, usage]) => usage !== undefined)
    : Object.entries(insights.heroes);
  let inDeck = 0;
  let usedIn = 0;
  let wonWith = 0;
  let plays = 0;
  let activations = 0;
  const playedBy: string[] = [];
  for (const [hero, usage] of heroes) {
    if (!usage) continue;
    const used = usage.usedIn[cardId] ?? 0;
    inDeck += usage.inDeck[cardId] ?? 0;
    usedIn += used;
    wonWith += usage.wonWith[cardId] ?? 0;
    plays += usage.plays[cardId] ?? 0;
    activations += usage.activations[cardId] ?? 0;
    if (used > 0) playedBy.push((names.cardName(hero) ?? hero).replace(/ \(.*\)$/, ""));
  }
  if (inDeck === 0 && usedIn === 0) return null;
  const lines: CardPlayLine[] = [
    { label: "In your deck", value: plural(inDeck, "game") },
    { label: "Came out", value: inDeck > 0 ? `${usedIn} of ${plural(inDeck, "game")}` : plural(usedIn, "game") },
  ];
  if (plays > 0) lines.push({ label: "Played", value: `${plays}×` });
  if (activations > 0) lines.push({ label: "Abilities used", value: `${activations}×` });
  if (usedIn > 0) {
    lines.push({
      label: "Won when it came out",
      value: `${Math.round((wonWith / usedIn) * 100)}% (${wonWith} of ${usedIn})`,
    });
  }
  if (!identityCardId && playedBy.length > 0) lines.push({ label: "Played with", value: playedBy.sort().join(", ") });
  return lines;
}
