/**
 * The pad and keyboard route of Take your seats: the order its focus stops are walked in (the stop keys specs and the pad
 * route have always used), and the filters and the list as two areas of it (`view/focus-areas.ts`).
 */
import { focusStopsOf } from "../../dom/element-stops.js";
import type { Rect } from "../../view/layout.js";
import type { FocusStop } from "../focus-route.js";
import type { FocusAreas } from "../../view/focus-areas.js";
import { seatsFocusOrder } from "../../view/screen-focus.js";
import { MAX_SEATS } from "../../view/seats-layout.js";
import type { RosterKeys } from "./seats-roster-model.js";

/** The stops that are the filters (search, the chips and their "i"), and the ones that are the list. */
const FILTER_STOP = /^(hero-search-toggle|hero-search|filters-toggle|hero-chip:.*|hero-chip-info:.*|aspect-tip-link)$/;
const LIST_STOP = /^(rec-toggle|drill-back|hero-clear|hero:.*|hero-rec:.*|hero-shelf:.*)$/;

/** The deck id a hero tile's focus stop names (`hero:<id>` or `hero-rec:<id>`), or null for any other stop. */
export function deckIdOfStop(key: string): string | null {
  if (key.startsWith("hero-rec:")) return key.slice("hero-rec:".length);
  if (key.startsWith("hero:")) return key.slice("hero:".length);
  return null;
}

/** The aspect of a chip's id (`aspect:justice`), or null. */
const aspectOfChip = (id: string): string | null => (id.startsWith("aspect:") ? id.slice("aspect:".length) : null);

export interface OrderInput {
  readonly keys: RosterKeys;
  readonly chipIds: readonly string[];
  readonly infoChipIds: ReadonlySet<string>;
  readonly narrow: boolean;
  readonly filtersToggle: boolean;
  readonly hasNotice: boolean;
  /** The aspect whose tip is open: its link follows its "i". */
  readonly tipAspect: string | null;
}

export function focusOrderOf(input: OrderInput): { readonly order: readonly string[]; readonly areas: FocusAreas } {
  const { keys } = input;
  const base = seatsFocusOrder({
    seatCount: MAX_SEATS,
    deckIds: keys.cardIds,
    ...(keys.shelfStopKeys ? { shelfStopKeys: keys.shelfStopKeys } : {}),
    heroChipIds: input.chipIds,
    filtersToggle: input.filtersToggle,
    narrow: input.narrow,
    hasRecommended: keys.hasRecommended,
    recommendedIds: keys.recIds,
    hasConflictNotice: input.hasNotice,
  }).map((key) => (key === "use-preconstructed" ? "preconstructed" : key));
  // Each aspect chip's "i" is a stop of its own, right after its chip; the open tip's lesson link follows its "i".
  const order = base.flatMap((key) => {
    if (!key.startsWith("hero-chip:")) return [key];
    const id = key.slice("hero-chip:".length);
    const aspect = aspectOfChip(id);
    if (aspect === null || !input.infoChipIds.has(id)) return [key];
    return [key, `hero-chip-info:${aspect}`, ...(input.tipAspect === aspect ? ["aspect-tip-link"] : [])];
  });
  return {
    order,
    areas: {
      filters: order.filter((key) => FILTER_STOP.test(key)),
      entry:
        order.find((key) => key.startsWith("hero-chip:")) ??
        order.find((key) => key === "filters-toggle") ??
        order.find((key) => key === "hero-search") ??
        null,
      list: order.filter((key) => LIST_STOP.test(key)),
    },
  };
}

/** Every stop gets an Inspect: a hero tile inspects its hero, any other jumps between the filters and the list. */
export function withInspect(
  stops: Map<string, FocusStop>,
  inspectTile: (key: string) => void,
  jump: () => void,
): Map<string, FocusStop> {
  for (const [key, stop] of stops) {
    if (stop.inspect) continue;
    stops.set(key, { ...stop, inspect: /^hero(-rec)?:/.test(key) ? () => inspectTile(key) : jump });
  }
  return stops;
}

/**
 * The route while the Pick a deck sheet is up: its rows and its Back, and nothing under it. The page also has a header
 * Back (`back`), so the stops are read from the sheet alone: two stops never share a key.
 */
export function sheetRoute(
  sheet: HTMLElement,
  rectOf: (target: Element) => Rect,
): { readonly order: readonly string[]; readonly stops: Map<string, FocusStop> } {
  const stops = focusStopsOf(sheet, rectOf);
  return { order: [...stops.keys()].filter((key) => key.startsWith("deck:")).concat("back"), stops };
}
