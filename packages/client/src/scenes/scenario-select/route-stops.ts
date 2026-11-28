/**
 * The focus stops of the page element for `FocusRoute`: the `[data-stop]` parts the elements mark (`dom/element-stops.ts`),
 * those on screen now (the list a phone's open stages sheet covers is not walked), and Y on a stop with no Inspect of its own jumping between the filters and the list.
 */
import { collectStops, focusStopsOf } from "../../dom/element-stops.js";
import type { Rect } from "../../view/layout.js";
import type { FocusStop } from "../focus-route.js";

/**
 * Whether a part is under a covered section (`data-covered`: a phone's open stages sheet hides the list), so it is not
 * walked. The region's own `visibility` is not read: it is hidden until the scene is shown, and the stops of a screen
 * that is still arriving are the route's to hold.
 */
function covered(element: HTMLElement, root: ParentNode): boolean {
  let node: Node | null = element;
  while (node && node !== root) {
    if (node instanceof HTMLElement && node.hasAttribute("data-covered")) return true;
    node = node instanceof ShadowRoot ? node.host : (node.parentNode ?? null);
  }
  return false;
}

/** The part of `whole` that shows in `view`, so a tile half out of its list is aimed where it can be pressed; `whole` when none of it shows. */
function shownIn(whole: Rect, view: Rect): Rect {
  const x = Math.max(whole.x, view.x);
  const y = Math.max(whole.y, view.y);
  const right = Math.min(whole.x + whole.width, view.x + view.width);
  const bottom = Math.min(whole.y + whole.height, view.y + view.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : whole;
}

export function routeStopsOf(
  page: ParentNode,
  toGame: (target: Element) => Rect,
  inspectFallback: () => void,
): Map<string, FocusStop> {
  const elements = new Map<string, HTMLElement>();
  for (const stop of collectStops(page))
    if (!elements.has(stop.key) && !covered(stop.element, page)) elements.set(stop.key, stop.element);
  const stops = new Map<string, FocusStop>();
  for (const [key, stop] of focusStopsOf(page, toGame)) {
    const element = elements.get(key);
    if (!element) continue;
    stops.set(key, {
      ...stop,
      // A tile that lies half under what is below its list (the stages bar) is pressed where its list shows it.
      rect: () => {
        const whole = typeof stop.rect === "function" ? stop.rect() : stop.rect;
        const view = typeof stop.view === "function" ? stop.view() : stop.view;
        return view ? shownIn(whole, view) : whole;
      },
      ...(stop.inspect ? {} : { inspect: inspectFallback }),
    });
  }
  return stops;
}
