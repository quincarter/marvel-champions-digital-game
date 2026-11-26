/**
 * A tap: the press and the release both on the element, within `TAP_SLOP_PX` of each other, and nothing scrolled in
 * between. The client's rule for every press control (CLAUDE.md, "no tap on finger lift"; `ui/tap.ts` and
 * `view/press-arm.ts` in the client): on a phone, the end of a scroll or swipe must never press whatever control the
 * finger lifts over. A bare `click` would fire for a swipe that started and ended on the same control.
 */

/** As the client's `view/press-arm.ts`. */
export const TAP_SLOP_PX = 10;

export interface TapOptions {
  /** Read at the press: false makes this press do nothing (a disabled control). */
  readonly enabled?: () => boolean;
}

/** Calls `handler` on each tap on `element`; returns the function that stops listening. */
export function onTap(
  element: HTMLElement,
  handler: (event: PointerEvent) => void,
  options: TapOptions = {},
): () => void {
  let press: {
    id: number;
    x: number;
    y: number;
    scrolled: boolean;
    /** Where every element under the press stood: a scroll inside a component's shadow root never reaches the window. */
    offsets: readonly (readonly [Element, number, number])[];
  } | null = null;
  const onScroll = (): void => {
    if (press) press.scrolled = true;
  };
  const end = (): void => {
    press = null;
    window.removeEventListener("scroll", onScroll, true);
  };
  const down = (event: PointerEvent): void => {
    if (event.button !== 0 || options.enabled?.() === false) return;
    const offsets = event
      .composedPath()
      .filter((node): node is Element => node instanceof Element)
      .map((node) => [node, node.scrollTop, node.scrollLeft] as const);
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, scrolled: false, offsets };
    // Any scroll under way (a list this control sits in) cancels the press: a swipe, not a tap.
    window.addEventListener("scroll", onScroll, true);
  };
  const up = (event: PointerEvent): void => {
    const held = press;
    end();
    if (!held || held.id !== event.pointerId || held.scrolled) return;
    // Disabled while held (the state changed under the finger): the release does nothing.
    if (options.enabled?.() === false) return;
    if (held.offsets.some(([node, top, left]) => node.scrollTop !== top || node.scrollLeft !== left)) return;
    if (Math.hypot(event.clientX - held.x, event.clientY - held.y) > TAP_SLOP_PX) return;
    handler(event);
  };
  const move = (event: PointerEvent): void => {
    if (
      press &&
      press.id === event.pointerId &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP_PX
    )
      end();
  };
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointercancel", end);
  element.addEventListener("pointerleave", end);
  return () => {
    end();
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointerup", up);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointercancel", end);
    element.removeEventListener("pointerleave", end);
  };
}

/** How long a press lasts before it is a hold, and how far it may wander and still be one: as the client's `view/hold-gesture.ts`. */
export const HOLD_MS = 420;
export const HOLD_SLOP_PX = 12;

/**
 * Calls `handler` for a press-and-hold (the mouse or a finger kept down on `element` for `HOLD_MS`, within
 * `HOLD_SLOP_PX` of where it began) and for a right-click: the gesture a card shares for "look at this" (Inspect).
 * A hold that fired swallows the release that ends it, so a tap on the same element does not also act. Returns the
 * function that stops listening.
 */
export function onHold(element: HTMLElement, handler: (event: Event) => void): () => void {
  let press: { id: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
  let firedAt = -Infinity;
  const end = (): void => {
    if (press) clearTimeout(press.timer);
    press = null;
  };
  const down = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    end();
    const held = { id: event.pointerId, x: event.clientX, y: event.clientY };
    const timer = setTimeout(() => {
      if (press?.id !== held.id) return;
      press = null;
      firedAt = performance.now();
      handler(event);
    }, HOLD_MS);
    press = { ...held, timer };
  };
  const move = (event: PointerEvent): void => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > HOLD_SLOP_PX)
      end();
  };
  const up = (event: PointerEvent): void => {
    end();
    // The release that ends a hold is not a tap: stopped before the element's tap listener hears it.
    if (performance.now() - firedAt < 1500 && event.button === 0) {
      firedAt = -Infinity;
      event.stopImmediatePropagation();
    }
  };
  const menu = (event: Event): void => {
    event.preventDefault();
    // A long press on a touch screen raises this too, after the hold already fired.
    if (performance.now() - firedAt < 1500) return;
    handler(event);
  };
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up, { capture: true });
  element.addEventListener("pointercancel", end);
  element.addEventListener("contextmenu", menu);
  return () => {
    end();
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", up, { capture: true });
    element.removeEventListener("pointercancel", end);
    element.removeEventListener("contextmenu", menu);
  };
}
