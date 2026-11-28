/**
 * Choose a scenario's pad and keyboard walk: the focus stops read off the drawn page, the two areas of them (the filters
 * and the list) that Y and B jump between, the chips' fold, and LT / RT paging a shelf row.
 */
import type { McScenarioSelectPage } from "../../views/scenario-select/mc-scenario-select-page/mc-scenario-select-page.js";
import type { DomRegion } from "../../dom/dom-region.js";
import { AreaJump, type FocusAreas } from "../../view/focus-areas.js";
import type { FocusRoute, FocusStop } from "../focus-route.js";
import type { PadFilters } from "../pad-filters.js";
import { routeStopsOf } from "./route-stops.js";

/** The stops that are the filters (search and the product chips), and the ones that are the list. */
const FILTER_STOP = /^(scenario-search-toggle|scenario-search|filters-toggle|scenario-chip:.*)$/;
const LIST_STOP = /^(drill-back|random-.*|scenario-clear|scenario:.*|scenario-shelf:.*)$/;

export interface FocusDeps {
  readonly page: () => McScenarioSelectPage | null;
  readonly region: () => DomRegion<McScenarioSelectPage> | null;
  readonly route: () => FocusRoute | null;
  readonly padFilters: () => PadFilters;
  /** Whether the last compose folded the chips, so Y knows whether it opens or folds them. */
  readonly chipsFolded: () => boolean;
  readonly compose: () => void;
  /** Each tile's shelf and place in it, by focus key. */
  readonly rowOfKey: () => ReadonlyMap<string, { readonly shelfId: string }>;
}

export class ScenarioFocus {
  stops = new Map<string, FocusStop>();
  /** The topmost scenario tile's key as of the last read, where focus starts on arrival. */
  firstTileKey: string | null = null;
  readonly #deps: FocusDeps;
  readonly #jump = new AreaJump();
  #areas: FocusAreas = { filters: [], entry: null, list: [] };

  constructor(deps: FocusDeps) {
    this.#deps = deps;
  }

  /** The area the focus is in (the filters or the list), for B. */
  get areas(): FocusAreas {
    return this.#areas;
  }

  /** Reads the stops off the drawn page, in reading order, and gives them to the route. */
  read(): void {
    const page = this.#deps.page();
    const region = this.#deps.region();
    if (!page || !region) return;
    this.stops = routeStopsOf(
      page,
      (target) => region.rectOf(target),
      () => this.jump(false),
    );
    const order = [...this.stops.keys()];
    this.firstTileKey = order.find((key) => key.startsWith("scenario:")) ?? null;
    this.#areas = {
      filters: order.filter((key) => FILTER_STOP.test(key)),
      entry:
        order.find((key) => key.startsWith("scenario-chip:")) ??
        order.find((key) => key === "filters-toggle") ??
        order.find((key) => key === "scenario-search") ??
        null,
      list: order.filter((key) => LIST_STOP.test(key)),
    };
    this.#deps.route()?.set(order, this.stops);
  }

  /** Y (or the Filters button) while a controller is in use: shows the chips, or folds them away again. */
  toggleFilters(): void {
    const route = this.#deps.route();
    const focus = route?.focused ?? null;
    const opening = this.#deps.chipsFolded();
    const onChip = focus?.startsWith("scenario-chip:") ?? false;
    const pad = this.#deps.padFilters();
    pad.toggle();
    this.#deps.compose();
    // The ring follows a pad or keyboard user; a mouse press leaves focus alone (no ring appears for it).
    if (focus === null && !pad.padMode) return;
    const target = opening ? this.#jump.toFilters(focus, this.#areas) : onChip ? this.#jump.toList(this.#areas) : null;
    if (target !== null) route?.focusKey(target);
  }

  /** LT / RT: pages the shelf row focus is in, as its chevrons would, and moves focus to the first card in view. */
  pageRow(direction: 1 | -1): void {
    const route = this.#deps.route();
    const row = this.#deps.rowOfKey().get(route?.focused ?? "");
    const first = row ? this.#deps.page()?.roster?.pageShelf(row.shelfId, direction) : null;
    if (!row || first == null) return;
    const key = `scenario:${first}`;
    if (this.stops.has(key)) route?.focusKey(key);
  }

  /** Y toggles focus between the filters and the list (back to the row it left); B (`fromBack`) also scrolls the list to its start. */
  jump(fromBack: boolean): void {
    // B from the list with the chips folded opens them first, so there is a row to land on.
    if (this.#deps.chipsFolded()) {
      this.#deps.padFilters().open();
      this.#deps.compose();
    }
    const route = this.#deps.route();
    const focus = route?.focused ?? null;
    const target = fromBack ? this.#jump.toFilters(focus, this.#areas) : this.#jump.toggle(focus, this.#areas);
    if (target === null) return;
    if (fromBack) this.#deps.page()?.roster?.scroller?.scrollTo({ top: 0 });
    route?.focusKey(target);
  }
}
