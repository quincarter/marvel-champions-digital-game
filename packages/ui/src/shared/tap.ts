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

function contains(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
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
    /** The clipping ancestors (scroll viewports) the press went through: a release outside one is not on the control. */
    clips: readonly Element[];
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
    const clips = offsets
      .map(([node]) => node)
      .filter((node) => {
        if (node === element) return false;
        const { overflowX, overflowY } = getComputedStyle(node);
        return [overflowX, overflowY].some((value) => value !== "visible" && value !== "");
      });
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, scrolled: false, offsets, clips };
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
    // Touch pointers are captured at the press, so the release arrives here even from outside the element (and
    // pointerleave is suppressed): check where the finger actually lifted.
    if (![element, ...held.clips].every((node) => contains(node.getBoundingClientRect(), event.clientX, event.clientY)))
      return;
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
  element.addEventListener("lostpointercapture", end);
  return () => {
    end();
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointerup", up);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointercancel", end);
    element.removeEventListener("pointerleave", end);
    element.removeEventListener("lostpointercapture", end);
  };
}
