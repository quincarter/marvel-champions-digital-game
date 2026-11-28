/**
 * The Decks & Collection focus route: the stops the rendered page marks (`data-stop`, collected through its shadow roots), the
 * pool cards made from the grid geometry (a card whose row is not drawn yet is still a stop: focusing it scrolls it in), and
 * the order `decksFocusOrder` gives them. Keys are the ones the specs and the pad have always used.
 */
import type { McDecksCards } from "../../components/decks/mc-decks-cards/McDecksCards.js";
import type { McDecksPage } from "../../views/decks/mc-decks-page/McDecksPage.js";
import type { DomRegion } from "../../dom/dom-region.js";
import { focusStopsOf } from "../../dom/element-stops.js";
import { clipToView } from "../../view/focus-list.js";
import { decksFocusOrder } from "../../view/screen-focus.js";
import type { DecksTab } from "../../view/decks-layout.js";
import type { FocusStop } from "../focus-route.js";
import type { DecksActions } from "./decks-actions.js";
import type { PageBuild } from "./decks-page-model.js";
import type { DecksState } from "./decks-state.js";

export interface RouteInput {
  readonly page: McDecksPage;
  readonly region: DomRegion<McDecksPage>;
  readonly build: PageBuild;
  readonly st: DecksState;
  readonly actions: DecksActions;
  readonly tab: DecksTab;
}

export function decksRouteOf(input: RouteInput): {
  readonly order: readonly string[];
  readonly stops: Map<string, FocusStop>;
} {
  const { page, region, build, st, actions, tab } = input;
  const stops = focusStopsOf(page, (target) => region.rectOf(target));
  // A pad or the keyboard only selects a deck (the tap also opens its Check): walking the list never leaves.
  for (const id of build.deckIds) {
    const stop = stops.get(`deck:${id}`);
    if (stop) stops.set(`deck:${id}`, { ...stop, activate: () => actions.keyDeck(id) });
  }
  const grid = page.section<McDecksCards>("mc-decks-cards")?.grid ?? null;
  build.cards.forEach((card, index) => {
    if (!grid) return;
    const box = (): DOMRect => grid.cellRect(index);
    const view = () => region.rectOf(grid);
    stops.set(`pool-card:${card.id as string}`, {
      // Clipped to the list, so the ring on a card scrolled half out of view never draws over the search or chips.
      rect: () => clipToView(region.rectOf({ getBoundingClientRect: box } as Element), view()),
      view,
      activate: () => actions.showPaneCard(card, true),
      inspect: () => actions.inspectCard(card),
      ensureVisible: () => grid.scrollToIndex(index),
    });
  });
  const own = build.page;
  const order = decksFocusOrder({
    showMarvelCdbImport: true,
    deckIds: build.deckIds,
    chipIds: own.list.chips.map((chip) => chip.id),
    poolCardIds: build.cards.map((card) => card.id as string),
    poolChipIds: build.selected
      ? [...(own.cards.foldable ? ["filters"] : []), ...own.cards.chips.map((chip) => chip.id)]
      : [],
    wide: build.wide,
    activeTab: tab,
    hasSelection: build.selected !== null,
    community: build.offer !== null,
    editable: build.selected !== null && build.offer === null && build.selected.deck.source.kind !== "precon",
    filtersExpanded: st.filtersExpanded,
    importOpen: st.importExportOpen,
  });
  return { order, stops };
}
