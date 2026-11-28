/**
 * Your stats' focus stops, read from its page of elements (`dom/element-stops.ts`): every `data-stop` part with a live
 * rect, the Matchups grid as the one stop whose arrows walk its cells, and the list's own keys for paging.
 */
import { collectStops, focusStopsOf } from "../dom/element-stops.js";
import { settleElements } from "../dom/element-settle.js";
import type { MountedElement } from "../dom/element-region.js";
import { pageTarget } from "../view/focus-list.js";
import type { FocusStop } from "./focus-route.js";

type Page = MountedElement<HTMLElementTagNameMap["mc-player-stats-page"]>;

/** The page's stops, once it and its children have rendered. */
export async function readStops(mounted: Page): Promise<Map<string, FocusStop>> {
  await settleElements(mounted.element);
  const { element, region } = mounted;
  const stops = new Map<string, FocusStop>(focusStopsOf(element, (target) => region.rectOf(target)));
  const grid = element.grid;
  // The grid is one stop whose arrows walk its cells; at its edge the arrow leaves it.
  if (grid && stops.has("grid:cell"))
    stops.set("grid:cell", {
      rect: () => region.rectOf(grid.cursorCell ?? grid.scroller ?? grid),
      view: () => region.rectOf(grid.scroller ?? grid),
      activate: () => undefined,
      ensureVisible: () => grid.reveal(),
      steer: (direction) => grid.step(direction),
    });
  return stops;
}

/** The keys of the list's stops, in reading order. */
export const listKeysOf = (page: Page): string[] => {
  const list = page.element.list;
  return list ? collectStops(list).map((stop) => stop.key) : [];
};

/** The stop Page Up / Page Down lands on in the list, from the one focused (or the matching end). */
export function pagedKeyOf(page: Page, focused: string | null, direction: 1 | -1): string | undefined {
  const keys = listKeysOf(page);
  const at = keys.indexOf(focused ?? "");
  const view = page.element.list?.scroller?.clientHeight ?? 300;
  const target = pageTarget(
    keys.map((_, i) => i),
    at === -1 ? null : at,
    direction,
    Math.max(1, Math.floor(view / 80)),
  );
  return target === undefined ? undefined : keys[target];
}
