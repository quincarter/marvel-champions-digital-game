/**
 * The focus stops of the page element for `FocusRoute`: the `[data-stop]` parts the elements mark (`dom/element-stops.ts`),
 * those on screen now (the list a phone's open stages sheet covers is not walked), a sideways rail's chips scrolled into
 * view, and Y on a stop with no Inspect of its own jumping between the filters and the list.
 */
import { collectStops, focusStopsOf } from "../../dom/element-stops.js";
import type { Rect } from "../../view/layout.js";
import type { FocusStop } from "../focus-route.js";

/** Whether the element is drawn and not hidden (`visibility`, `display`), so a stop under a covering sheet is skipped. */
function onScreen(element: HTMLElement): boolean {
  if (typeof element.checkVisibility === "function") return element.checkVisibility({ visibilityProperty: true });
  return element.getClientRects().length > 0;
}

export function routeStopsOf(
  page: ParentNode,
  toGame: (target: Element) => Rect,
  inspectFallback: () => void,
): Map<string, FocusStop> {
  const elements = new Map<string, HTMLElement>();
  for (const stop of collectStops(page))
    if (!elements.has(stop.key) && onScreen(stop.element)) elements.set(stop.key, stop.element);
  const stops = new Map<string, FocusStop>();
  for (const [key, stop] of focusStopsOf(page, toGame)) {
    const element = elements.get(key);
    if (!element) continue;
    stops.set(key, {
      ...stop,
      ...(key.startsWith("scenario-chip:")
        ? { ensureVisible: () => element.scrollIntoView({ block: "nearest", inline: "nearest" }) }
        : {}),
      ...(stop.inspect ? {} : { inspect: inspectFallback }),
    });
  }
  return stops;
}
