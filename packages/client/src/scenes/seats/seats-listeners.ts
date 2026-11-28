/** The events the Take your seats page raises besides its sections' presses, handed to the scene. */
import type { SeatsEvent } from "../../components/seats/seats.types.js";
import { refreshPackArt } from "../../art/pack-art.js";
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
