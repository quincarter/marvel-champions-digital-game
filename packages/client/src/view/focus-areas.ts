/**
 * Two areas on a screen with a long list under a block of filters (Scenario select, Take your seats): the filters and
 * search at the top, and the list below. A pad cannot scroll back up once the list has carried focus down, so Y and B
 * jump between the two: Y from the filters goes back to the list item left, and B inside the list returns to the
 * filters (the screen scrolls the list back to its start).
 *
 * Pure: the screen says which stops are which, this answers where focus goes.
 */

export interface FocusAreas {
  /** The filter and search stops, in route order. The first of `chips` is where a jump to the filters lands. */
  readonly filters: readonly string[];
  /** Where a jump to the filters lands: the first filter chip (or the search field when there are no chips). */
  readonly entry: string | null;
  /** The list's stops, in route order. */
  readonly list: readonly string[];
}

export type FocusArea = "filters" | "list" | null;

export function areaOf(key: string | null, areas: FocusAreas): FocusArea {
  if (key === null) return null;
  if (areas.filters.includes(key)) return "filters";
  if (areas.list.includes(key)) return "list";
  return null;
}

/** Remembers the list stop focus left, so a jump back to the list returns to it. */
export class AreaJump {
  #left: string | null = null;

  /**
   * Y: from the filters, to the list item left (or the list's first stop); from anywhere else, to the filters, noting
   * the list stop it came from. Null when there is nowhere to go.
   */
  toggle(focus: string | null, areas: FocusAreas): string | null {
    if (areaOf(focus, areas) === "filters") return this.#listTarget(areas);
    return this.toFilters(focus, areas);
  }

  /** B inside the list (or Y from outside the filters): to the first filter chip. Null when the screen has none. */
  toFilters(focus: string | null, areas: FocusAreas): string | null {
    if (areas.entry === null) return null;
    if (areaOf(focus, areas) === "list") this.#left = focus;
    return areas.entry;
  }

  /** The list stop focus left (or the list's first stop): where a collapse of the filters returns focus to. */
  toList(areas: FocusAreas): string | null {
    return this.#listTarget(areas);
  }

  #listTarget(areas: FocusAreas): string | null {
    if (this.#left !== null && areas.list.includes(this.#left)) return this.#left;
    return areas.list[0] ?? null;
  }
}
