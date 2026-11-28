/**
 * The focus stops of a page built from custom elements. An element marks a focusable part with `data-stop="<key>"` (the
 * keys the specs and the pad route already use: `difficulty:expert`, `modular:bomb_scare`, `deal-it-out`); this walks the
 * page, open shadow roots included, and hands the keys to `FocusRoute` with live rects, so nothing is laid out twice.
 *
 * Activation is `click()` on a button-like element and `focus()` on a field; an element that offers an Inspect has an
 * `inspect()` method. A stop inside a scroll container names it as its `view` (the ring hides while it is scrolled away)
 * and scrolls itself into view when focus lands on it.
 */
import type { FocusStop } from "../scenes/focus-route.js";
import type { Rect } from "../view/layout.js";

export interface ElementStop {
  readonly key: string;
  readonly element: HTMLElement;
  /** Where the part is now, in viewport pixels. */
  readonly rect: () => DOMRect;
}

const keyOf = (element: Element): string => (element as HTMLElement).dataset?.stop ?? "";

/** Every `[data-stop]` under `root`, in document order, through open shadow roots. */
export function collectStops(root: ParentNode): ElementStop[] {
  const found: ElementStop[] = [];
  const visit = (node: ParentNode): void => {
    for (const element of node.querySelectorAll<HTMLElement>("*")) {
      const key = keyOf(element);
      if (key.length > 0) found.push({ key, element, rect: () => element.getBoundingClientRect() });
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };
  if (root instanceof HTMLElement) {
    const key = keyOf(root);
    if (key.length > 0) found.push({ key, element: root, rect: () => root.getBoundingClientRect() });
    if (root.shadowRoot) visit(root.shadowRoot);
  }
  visit(root);
  return found;
}

/** Whether the browser would draw a focus ring on `element` (a keyboard or assistive focus, not a pointer's). */
function focusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

/** The scroll container `element` sits in (vertical or sideways), through shadow roots, or null. */
export function scrollerOf(element: Element): HTMLElement | null {
  let node: Node | null = element.parentNode ?? (element.getRootNode() as ShadowRoot | undefined)?.host ?? null;
  while (node) {
    if (node instanceof ShadowRoot) node = node.host;
    if (node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      const scrolls = (overflow: string): boolean => overflow === "auto" || overflow === "scroll";
      if (scrolls(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
      // A sideways rail (the filter chips) is a scroller too: its chips scroll into view along it.
      if (scrolls(style.overflowX) && node.scrollWidth > node.clientWidth + 1) return node;
    }
    node = node.parentNode;
  }
  return null;
}

/** What Enter does on `element`: a field takes the caret, anything else is pressed. */
export function activateStop(element: HTMLElement): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.focus();
  else if (typeof (element as { focusInput?: () => void }).focusInput === "function")
    (element as unknown as { focusInput(): void }).focusInput();
  else element.click();
}

/** The stops as `FocusRoute` wants them. `toGame` turns a viewport box into the game's coordinates (`DomRegion.rectOf`). */
export function focusStopsOf(root: ParentNode, toGame: (target: Element) => Rect): Map<string, FocusStop> {
  const stops = new Map<string, FocusStop>();
  for (const { key, element } of collectStops(root)) {
    if (stops.has(key)) continue;
    const inspect = (element as { inspect?: () => void }).inspect;
    stops.set(key, {
      rect: () => toGame(element),
      activate: () => activateStop(element),
      ...(typeof inspect === "function" ? { inspect: () => inspect.call(element) } : {}),
      view: () => {
        const scroller = scrollerOf(element);
        return scroller ? toGame(scroller) : toGame(element);
      },
      ensureVisible: () => {
        if (scrollerOf(element)) element.scrollIntoView({ block: "nearest", inline: "nearest" });
      },
    });
  }
  return stops;
}

/**
 * Tells `onFocus` the key of a `[data-stop]` part that took focus (a screen reader, a click on a native button): the
 * route follows, so Enter, Space and Inspect then act on that part and no other. Returns the function that undoes it.
 *
 * `visibleOnly`: only a focus the browser would draw a ring for (`:focus-visible`: a key, a screen reader) counts, so a
 * tap or a click on a control moves the route no more than it did before the screen was built from elements.
 */
export function bindStopFocus(
  root: HTMLElement,
  onFocus: (key: string) => void,
  options: { readonly visibleOnly?: boolean } = {},
): () => void {
  const handler = (event: FocusEvent): void => {
    const hit = event
      .composedPath()
      .find((node): node is HTMLElement => node instanceof HTMLElement && keyOf(node).length > 0);
    if (!hit) return;
    if (options.visibleOnly && !focusVisible(hit)) return;
    onFocus(keyOf(hit));
  };
  root.addEventListener("focusin", handler);
  return () => root.removeEventListener("focusin", handler);
}
