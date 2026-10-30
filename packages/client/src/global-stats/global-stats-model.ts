/**
 * The global win rates as the Your stats screen draws them: `StatsSection`s with the same rows as its Heroes, Villains
 * and Encounter sections, so one list view serves both. Pure: names come in through `StatsNames`.
 *
 * A row's value is the win rate and its detail the games behind it (the Worker serves only rows with enough games).
 * A hero or modular set this build has no name for is dropped, since it cannot be drawn or told apart. Empty sections
 * are left out.
 */
import type { GlobalRow, GlobalStats, GlobalVillainCards } from "@mc/sync-worker/global-protocol";
import type { VillainDecks } from "../view/deck-insights.js";
import {
  LOSS_LABELS,
  type LossCause,
  type LossPart,
  type StatRow,
  type StatsNames,
  type StatsSection,
} from "../view/player-stats-model.js";

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const percent = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");

/** A row's losses in the order Your stats draws them. */
function lossesOf(row: GlobalRow): { losses?: readonly LossPart[] } {
  const losses = (Object.keys(LOSS_LABELS) as LossCause[])
    .filter((cause) => (row.causes[cause] ?? 0) > 0)
    .map((cause) => ({ cause, label: LOSS_LABELS[cause], count: row.causes[cause]! }));
  return losses.length > 0 ? { losses } : {};
}

function sectionOf(
  id: string,
  title: string,
  noun: string,
  many: string,
  rows: readonly GlobalRow[],
  nameOf: (key: string) => string | undefined,
  rowId: string,
  /** The key is a card id: the row leads with that card's picture and gets the card hover, like your own hero rows. */
  keyIsCard = false,
): StatsSection | null {
  const named = rows
    .flatMap((row) => {
      const name = nameOf(row.key);
      return name === undefined ? [] : [{ row, name }];
    })
    .sort((a, b) => b.row.games - a.row.games || a.name.localeCompare(b.name));
  if (named.length === 0) return null;
  const stats: StatRow[] = named.map(({ row, name }) => ({
    kind: "stat",
    id: `${rowId}:${row.key}`,
    label: name,
    value: percent(row.wins, row.games),
    detail: plural(row.games, "game"),
    ...(keyIsCard ? { cardId: row.key } : {}),
    ...lossesOf(row),
  }));
  return { id, title, count: plural(stats.length, noun, many), rows: stats };
}

/** A villain name this build knows, each part of a " & " join checked; with no lookup nothing is kept. */
const knownVillain =
  (names: StatsNames) =>
  (name: string): string | undefined =>
    names.isVillain && name.split(" & ").every((part) => names.isVillain!(part)) ? name : undefined;

export function globalSectionsOf(stats: GlobalStats, names: StatsNames): StatsSection[] {
  return [
    sectionOf(
      "global:heroes",
      "Heroes",
      "hero",
      "heroes",
      stats.heroes,
      (id) => names.cardName(id),
      "global:hero",
      true,
    ),
    sectionOf(
      "global:villains",
      "Villains",
      "villain",
      "villains",
      stats.villains,
      knownVillain(names),
      "global:villain",
    ),
    sectionOf(
      "global:encounter",
      "Encounter",
      "modular set",
      "modular sets",
      stats.modulars,
      (id) => names.setName?.(id),
      "global:set",
    ),
  ].filter((section): section is StatsSection => section !== null);
}

/** One villain's decks, so `againstVillainOf` reads the world's numbers the way it reads yours. */
export const globalVillainDecksOf = (cards: GlobalVillainCards): VillainDecks => ({
  wins: cards.wins,
  losses: cards.losses,
  inWins: cards.inWins,
  inLosses: cards.inLosses,
});
