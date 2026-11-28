/**
 * Your stats' tabs (`scenes/player-stats.ts`): which tabs there are for these stats, and the hero Cards by hero shows.
 * Pure: no layout (each tab's content is `player-stats-blocks.ts`, laid out by CSS in the page's elements).
 */
import { t } from "../i18n/translate.js";
import type { HeroCardsView, PlayerStats } from "./player-stats-model.js";

export type StatsTab =
  | "overview"
  | "heroes"
  | "villains"
  | "matchups"
  | "aspects"
  | "encounter"
  | "records"
  | "all-cards"
  | "decks"
  | "cards";

export interface StatsTabEntry {
  readonly id: StatsTab;
  readonly label: string;
}

/** The tabs this player's stats have: Devices only once a game says where it was played, Cards once a hero has games. */
export function statsTabsOf(stats: PlayerStats): readonly StatsTabEntry[] {
  const has = (id: string) => stats.sections.some((section) => section.id === id);
  return [
    { id: "overview", label: t("stats.tab.overview") },
    ...(has("heroes") ? [{ id: "heroes" as const, label: t("stats.tab.heroes") }] : []),
    ...(has("villains") ? [{ id: "villains" as const, label: t("stats.tab.villains") }] : []),
    ...(stats.matchups ? [{ id: "matchups" as const, label: t("stats.tab.matchups") }] : []),
    ...(has("aspects") ? [{ id: "aspects" as const, label: t("stats.tab.aspects") }] : []),
    // Side schemes and modular sets share Encounter; devices sit under Records.
    ...(has("side-schemes") || has("encounter") ? [{ id: "encounter" as const, label: t("stats.tab.encounter") }] : []),
    ...(has("records") || has("devices") ? [{ id: "records" as const, label: t("stats.tab.records") }] : []),
    ...(stats.allCards ? [{ id: "all-cards" as const, label: t("stats.tab.cards") }] : []),
    ...(stats.decks.length > 0 ? [{ id: "decks" as const, label: t("stats.tab.decks") }] : []),
    ...(stats.heroCards.length > 0 ? [{ id: "cards" as const, label: t("stats.tab.cardsByHero") }] : []),
  ];
}

/** The hero at `index`, wrapped into range; undefined with no heroes. */
export function heroAt(stats: PlayerStats, index: number): HeroCardsView | undefined {
  const count = stats.heroCards.length;
  return count === 0 ? undefined : stats.heroCards[((index % count) + count) % count];
}
