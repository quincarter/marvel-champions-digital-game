/**
 * The deck builder's narrow (phone and tablet portrait) layout shows one of three tabs at a time (issue #544): the
 * pool, the deck, and "From your games". This module is the pure part of that: which tabs exist, their words (the Deck
 * tab carries the live count so the deck is seen growing while on the pool), how the tab row divides its width, what
 * LB / RB do, how many filters are on, and the pad route for each tab. Scenes draw; nothing here touches Phaser.
 */
import type { PoolFilter, PoolSort } from "./deck-builder-model.js";
import type { Rect } from "./layout.js";

export type DeckBuilderTab = "pool" | "deck" | "games";

/** The tabs in order, left to right. Campaign mode has no "From your games" (it reads a loose deck's play history). */
export function deckBuilderTabs(campaign: boolean): readonly DeckBuilderTab[] {
  return campaign ? ["pool", "deck"] : ["pool", "deck", "games"];
}

/** The tab a visit opens on: `railTab: "games"` (Decks & Collection's "Build my own from this") opens From your games. */
export function startTab(railTab: "deck" | "games" | undefined, campaign: boolean): DeckBuilderTab {
  return railTab === "games" && !campaign ? "games" : "pool";
}

/**
 * A tab's words. Deck reads "Deck 15/40" while the deck is under the minimum, and "Deck 40" from there on, using the
 * same counted cards the legality line states (identity and permanent cards are left out of both).
 */
export function deckBuilderTabLabel(tab: DeckBuilderTab, counted: number, minimum: number): string {
  if (tab === "pool") return "Pool";
  if (tab === "games") return "From your games";
  return counted < minimum ? `Deck ${counted}/${minimum}` : `Deck ${counted}`;
}

/**
 * The tab row's cells inside `row`: each tab's width follows the length of its words (plus padding), so "From your
 * games" has room to read in full beside "Pool" instead of all three being equal thirds.
 */
export function deckBuilderTabRects(labels: readonly string[], row: Rect, gap: number, padding = 5): readonly Rect[] {
  const room = row.width - gap * (labels.length - 1);
  const weights = labels.map((text) => text.length + padding);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let x = row.x;
  return weights.map((weight) => {
    const width = (room * weight) / total;
    const rect: Rect = { x, y: row.y, width, height: row.height };
    x += width + gap;
    return rect;
  });
}

/** LB (-1) / RB (+1): the neighbouring tab, staying put at either end. */
export function stepDeckBuilderTab(
  tabs: readonly DeckBuilderTab[],
  current: DeckBuilderTab,
  direction: 1 | -1,
): DeckBuilderTab {
  const at = tabs.indexOf(current);
  if (at < 0) return tabs[0]!;
  return tabs[Math.min(tabs.length - 1, Math.max(0, at + direction))]!;
}

/** How many of the pool's filters are on, for the "Filters" chip: the type chip, pack, wave and a non-default sort. */
export function activeDeckFilterCount(filter: PoolFilter, sort: PoolSort): number {
  return (
    (filter.type != null ? 1 : 0) +
    (filter.packCode != null ? 1 : 0) +
    (filter.cycleId != null ? 1 : 0) +
    (sort !== "default" ? 1 : 0)
  );
}

export interface DeckBuilderNarrowFocusInput {
  readonly tab: DeckBuilderTab;
  readonly tabs: readonly DeckBuilderTab[];
  readonly campaign: boolean;
  /** The filters sit behind a "Filters" chip (a phone), and whether it is open. Otherwise they are always shown. */
  readonly filtersFolded: boolean;
  readonly filtersOpen: boolean;
  readonly filterTextEntered: boolean;
  readonly aspectIds: readonly string[];
  readonly typeFilterIds: readonly string[];
  readonly poolCardIds: readonly string[];
  readonly rewardIds: readonly string[];
  readonly showDelete: boolean;
  readonly showFreeze: boolean;
  /** From your games' Cut / Add stops, in the order drawn. */
  readonly gamesIds: readonly string[];
}

/**
 * The pad and keyboard route for the narrow layout: Back, the tab row, then only the controls of the tab that shows.
 * A control in another tab is not drawn, so it is not here either.
 */
export function deckBuilderNarrowFocusOrder(input: DeckBuilderNarrowFocusInput): readonly string[] {
  const head = ["back", ...input.tabs.map((tab) => `tab:${tab}`)];
  if (input.tab === "pool") {
    const filters =
      !input.filtersFolded || input.filtersOpen
        ? [
            ...input.typeFilterIds.map((id) => `type:${id}`),
            "pack:prev",
            "pack:name",
            "pack:next",
            "pack:cycle",
            "pack:sort",
          ]
        : [];
    return [
      ...head,
      "filter-text",
      ...(input.filterTextEntered ? ["filter-clear"] : []),
      "pool-view",
      ...(input.filtersFolded ? ["filters-toggle"] : []),
      ...filters,
      ...input.poolCardIds.map((id) => `card:${id}`),
    ];
  }
  if (input.tab === "games") return [...head, ...input.gamesIds];
  return [
    ...head,
    ...input.aspectIds.map((id) => `aspect:${id}`),
    ...(input.campaign ? [] : ["name"]),
    ...input.rewardIds.map((id) => `reward:${id}`),
    ...(input.campaign ? [] : ["preconstructed", "clear"]),
    ...(input.showDelete ? ["delete"] : []),
    ...(input.showFreeze ? ["freeze-deck"] : []),
    "save",
  ];
}
