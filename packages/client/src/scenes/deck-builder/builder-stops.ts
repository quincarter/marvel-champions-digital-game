/**
 * The builder's focus stops and their order. The stops are the page's `data-stop` parts, read through the collected stops
 * map (`dom/element-stops.ts`); a pool card that is not built (the list is windowed) has no part, so its stop is made here
 * from where the list lays it out, and scrolls the list to it when focus lands on it. The order is the old route's
 * (`deckBuilderFocusOrder`, `deckBuilderNarrowFocusOrder`): every key is kept.
 */
import type { AnyCard } from "@mc/content";
import { SELECTABLE_ASPECTS } from "../../view/deck-builder-model.js";
import { DECK_BUILDER_TABS, deckBuilderNarrowFocusOrder } from "../../view/deck-builder-tabs.js";
import { deckBuilderFocusOrder } from "../../view/screen-focus.js";
import type { McDeckBuilderPage } from "../../views/deck-builder/mc-deck-builder-page/mc-deck-builder-page.js";
import { focusStopsOf } from "../../dom/element-stops.js";
import type { Rect } from "../../view/layout.js";
import type { FocusStop } from "../focus-route.js";
import type { BuilderState } from "./builder-state.js";
import { QUICK_FILTERS, SHOW_TOGGLE_IDS, TYPE_FILTERS } from "./filters-data.js";

export interface StopsResult {
  readonly stops: Map<string, FocusStop>;
  readonly order: readonly string[];
}

/** What the stops need of the scene: the region's game-coordinate conversion, and what a stop does. */
export interface StopsHost {
  readonly rectOf: (target: Element) => Rect;
  readonly add: (cardId: string) => void;
  readonly open: (cardId: string) => void;
}

/** A viewport box in game coordinates, through where the page itself is (its box and its game rect fix the scale). */
function gameBoxOf(
  page: HTMLElement,
  host: StopsHost,
  box: { x: number; y: number; width: number; height: number },
): Rect {
  const at = page.getBoundingClientRect();
  const game = host.rectOf(page);
  const scale = at.width > 0 ? game.width / at.width : 1;
  return {
    x: game.x + (box.x - at.x) * scale,
    y: game.y + (box.y - at.y) * scale,
    width: box.width * scale,
    height: box.height * scale,
  };
}

/** The keys of every part of the page whose key starts with a prefix, in the order drawn. */
const keysWith = (stops: ReadonlyMap<string, FocusStop>, ...prefixes: string[]): string[] =>
  [...stops.keys()].filter((key) => prefixes.some((prefix) => key.startsWith(prefix)));

export function buildStops(
  page: McDeckBuilderPage,
  state: BuilderState,
  pool: readonly AnyCard[],
  wide: boolean,
  host: StopsHost,
): StopsResult {
  const stops = new Map<string, FocusStop>(focusStopsOf(page, host.rectOf));
  const list = page.poolList;
  // A card's stop: its part where it is built, else the cell the list would draw there.
  pool.forEach((card, index) => {
    const key = `card:${card.id as string}`;
    if (stops.has(key) || !list) return;
    const scroller = list.scroller;
    stops.set(key, {
      rect: () => {
        const box = list.rectOfIndex(index);
        return box ? gameBoxOf(page, host, box) : { x: 0, y: 0, width: 0, height: 0 };
      },
      view: () => (scroller ? host.rectOf(scroller) : { x: 0, y: 0, width: 0, height: 0 }),
      activate: () => host.add(card.id as string),
      inspect: () => host.open(card.id as string),
      ensureVisible: () => list.scrollToIndex(index),
    });
  });
  const aspectIds = [...SELECTABLE_ASPECTS];
  const typeFilterIds = [...SHOW_TOGGLE_IDS, ...TYPE_FILTERS.map((f) => f.id)];
  const quickFilterIds = QUICK_FILTERS.map((f) => f.id);
  const poolCardIds = pool.map((card) => card.id as string);
  const rewardIds = (state.campaignModel?.rewards ?? []).map((reward, at) => `${at}:${reward.cardId as string}`);
  const folded = stops.has("filters-toggle");
  // An open aspect tip's "Aspects" link is the first stop.
  const tipLink = stops.has("aspect-tip-link") ? ["aspect-tip-link"] : [];

  if (!state.identity) {
    const order = state.startFor
      ? deckBuilderFocusOrder({
          identityChosen: false,
          identityIds: [],
          identityExtraIds: keysWith(stops, "start:"),
          aspectIds: [],
          typeFilterIds: [],
          poolCardIds: [],
        })
      : deckBuilderFocusOrder({
          identityChosen: false,
          identityExtraIds: ["identity-search"],
          identityIds: keysWith(stops, "identity:").map((key) => key.slice("identity:".length)),
          aspectIds: [],
          typeFilterIds: [],
          poolCardIds: [],
        });
    return { stops, order };
  }

  const order = wide
    ? deckBuilderFocusOrder({
        identityChosen: true,
        identityIds: [],
        aspectIds,
        typeFilterIds,
        quickFilterIds,
        chartIds: keysWith(stops, "chart:", "odds:"),
        poolCardIds,
        deckListIds: ["deck-sort", "deck-review"],
        showName: !state.campaign,
        showPreconClear: !state.campaign,
        showDelete: !state.campaign && state.savedDeck !== null,
        railIds: keysWith(stops, "rail:", "games:"),
        filterExtraIds: [
          ...(state.filterText ? ["filter-clear"] : []),
          "filter-help",
          "pool-view",
          ...(folded ? ["filters-toggle"] : []),
        ],
        filtersFolded: folded,
        filtersOpen: state.filtersOpen,
        rewardIds,
      })
    : deckBuilderNarrowFocusOrder({
        tab: state.tab,
        tabs: DECK_BUILDER_TABS,
        campaign: state.campaign !== null,
        filtersFolded: folded,
        filtersOpen: state.filtersOpen,
        filterTextEntered: state.filterText !== "",
        aspectIds,
        typeFilterIds,
        quickFilterIds,
        oddsIds: keysWith(stops, "odds:"),
        poolCardIds,
        rewardIds,
        showDelete: !state.campaign && state.savedDeck !== null,
        showFreeze: state.campaign?.optionalFreeze?.eligible === true,
        gamesIds: keysWith(stops, "games:"),
      });
  return { stops, order: [...tipLink, ...order] };
}
