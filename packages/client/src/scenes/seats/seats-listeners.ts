/** The events the Take your seats page raises besides its sections' presses, handed to the scene. */
import type { SeatsEvent } from "../../components/seats/seats.types.js";
import { refreshPackArt } from "../../art/pack-art.js";
import { collectStops } from "../../dom/element-stops.js";
import { deckIdOfStop } from "./seats-order.js";

/** What the scene reads of the filters' search field (`McSearchField`). */
export interface SearchFieldLike {
  readonly focused: boolean;
  readonly text: string;
  blur(): void;
}

export interface PageHandlers {
  /** A section's `mc-seats` press. */
  readonly seats: (detail: SeatsEvent) => void;
  /** The caret went into or left the search field (the route stands aside while it is). */
  readonly typing: (focused: boolean) => void;
  /** The mouse is over a hero tile of this deck (or none): the detail panel explains it. */
  readonly hover: (deckId: string | null) => void;
}

export function wirePage(element: HTMLElement, on: PageHandlers): void {
  element.addEventListener("mc-seats", (event) => on.seats((event as CustomEvent<SeatsEvent>).detail));
  element.addEventListener("mc-search-focus", (event) =>
    on.typing((event as CustomEvent<{ focused: boolean }>).detail.focused),
  );
  // A pack picture's blob URL went stale before its lazy image loaded: read it again, once.
  element.addEventListener("mc-image-error", (event) => {
    const { key, src } = (event as CustomEvent<{ key?: string; src?: string | null }>).detail;
    if (key !== undefined) refreshPackArt(key, src ?? undefined);
  });
  element.addEventListener("pointerover", (event) => {
    if ((event as PointerEvent).pointerType !== "mouse") return;
    for (const node of event.composedPath()) {
      const key = node instanceof HTMLElement ? node.dataset.stop : undefined;
      const id = key === undefined ? null : deckIdOfStop(key);
      if (id !== null) return on.hover(id);
    }
    on.hover(null);
  });
  element.addEventListener("pointerleave", () => on.hover(null));
}

/** The first element named `tag` under `root`, through the open shadow roots. */
function deepFind(root: ParentNode, tag: string): Element | null {
  for (const node of root.querySelectorAll("*")) {
    if (node.localName === tag) return node;
    const inside = node.shadowRoot ? deepFind(node.shadowRoot, tag) : null;
    if (inside) return inside;
  }
  return null;
}

/** The open tip's zone: its chip's "i" and the plate, as one box (the gap between them is part of it). Null while either is not drawn. */
export function tipZoneOf(page: HTMLElement, aspect: string): DOMRect | null {
  const info = collectStops(page).find((stop) => stop.key === `hero-chip-info:${aspect}`)?.element;
  // The plate element is the whole screen (its backdrop); the plate itself is the box inside it.
  const plate = deepFind(page.shadowRoot ?? page, "mc-tip-plate")?.shadowRoot?.querySelector(".plate");
  if (!info || !plate) return null;
  const a = info.getBoundingClientRect();
  const b = plate.getBoundingClientRect();
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return new DOMRect(left, top, Math.max(a.right, b.right) - left, Math.max(a.bottom, b.bottom) - top);
}

/** A mouse that leaves the open tip's zone shuts it (a touch or pad has no leaving: its own taps and focus do that). Returns the undo. */
export function watchTipLeave(zone: () => DOMRect | null, close: () => void): () => void {
  const move = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") return;
    const box = zone();
    if (
      box &&
      (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
    )
      close();
  };
  window.addEventListener("pointermove", move, true);
  return () => window.removeEventListener("pointermove", move, true);
}
