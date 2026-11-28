/**
 * How a card picture in a panel says "a card is here": it raises composed events the client wires to the card hover
 * popover and to Inspect (`dom/card-events.ts`), so no panel names a Phaser scene or a popover.
 *
 * - `mc-card-hover` `{ cardId, face?, rect }` when a mouse moves onto the picture; `mc-card-hover-end` when it leaves.
 * - `mc-card-inspect` `{ cardId, face? }` on a press-and-hold or a right-click.
 */
import { onHold } from "./tap.js";

/** Which card a picture shows, and which face when it is not the card's default (a villain stage, a scheme's B side). */
export interface CardRef {
  readonly cardId: string;
  readonly face?: unknown;
}

export interface CardHoverDetail extends CardRef {
  /** The picture's box in viewport pixels at the moment the mouse entered. */
  readonly rect: DOMRectReadOnly;
}

export interface CardHoverEndDetail {
  readonly cardId: string;
}

declare global {
  interface HTMLElementEventMap {
    "mc-card-hover": CustomEvent<CardHoverDetail>;
    "mc-card-hover-end": CustomEvent<CardHoverEndDetail>;
    "mc-card-inspect": CustomEvent<CardRef>;
  }
}

const raise = <T>(element: Element, name: string, detail: T): void => {
  element.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
};

/**
 * Makes `element` a card picture for `card()` (null: none now): the mouse over it raises the hover events and a hold
 * inspects. Returns the function that undoes it (call it when the element goes). A finger never raises a hover.
 */
export function watchCard(element: HTMLElement, card: () => CardRef | null): () => void {
  const enter = (event: PointerEvent): void => {
    const ref = card();
    if (ref && event.pointerType === "mouse")
      raise<CardHoverDetail>(element, "mc-card-hover", { ...ref, rect: element.getBoundingClientRect() });
  };
  const leave = (): void => {
    const ref = card();
    if (ref) raise<CardHoverEndDetail>(element, "mc-card-hover-end", { cardId: ref.cardId });
  };
  element.addEventListener("pointerenter", enter);
  element.addEventListener("pointerleave", leave);
  const stopHold = onHold(element, () => {
    const ref = card();
    if (ref) raise<CardRef>(element, "mc-card-inspect", ref);
  });
  return () => {
    element.removeEventListener("pointerenter", enter);
    element.removeEventListener("pointerleave", leave);
    stopHold();
  };
}
