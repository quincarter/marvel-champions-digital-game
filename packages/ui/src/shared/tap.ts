/**
 * A tap: the press and the release both on the element, within `TAP_SLOP_PX` of each other, and nothing scrolled in
 * between. The client's rule for every press control (CLAUDE.md, "no tap on finger lift"; `ui/tap.ts` and
 * `view/press-arm.ts` in the client): on a phone, the end of a scroll or swipe must never press whatever control the
 * finger lifts over. A bare `click` would fire for a swipe that started and ended on the same control.
 */

import type { TapOptions } from "./tap.types.js";

/** As the client's `view/press-arm.ts`. */
export const TAP_SLOP_PX = 10;

/**
 * Whether the point is inside `rect`. A box with no size (a host drawn as `display: contents`, or no layout at all) can't
 * be hit-tested, so it doesn't refuse the release: the other checks still decide.
 */
function contains(rect: DOMRect, x: number, y: number): boolean {
  if (rect.width === 0 && rect.height === 0) return true;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** The clipping ancestors (scroll viewports) among a press's path: a point outside one is not on the control. */
function clippingAncestors(path: readonly Element[], element: Element): readonly Element[] {
  return path.filter((node) => {
    if (node === element) return false;
    const { overflowX, overflowY } = getComputedStyle(node);
    return [overflowX, overflowY].some((value) => value !== "visible" && value !== "");
  });
}

/**
 * Whether the point is on `element` and inside every clipping ancestor, by their boxes now. Touch pointers are
 * captured at the press, so a release (or a timer) can see a finger that has left the element with no pointerleave:
 * this checks where it actually is.
 */
function pointOnControl(element: Element, clips: readonly Element[], x: number, y: number): boolean {
  return [element, ...clips].every((node) => contains(node.getBoundingClientRect(), x, y));
}

/** Armed-press cancels of every element with an `onTap` listener. */
const tapCancels = new Map<Element, () => void>();

/** The elements up the composed tree (through shadow roots) from `node`, itself included. */
function composedAncestors(node: Node): Node[] {
  const chain: Node[] = [];
  let at: Node | null = node;
  while (at) {
    chain.push(at);
    const root: Node = at.getRootNode();
    at = at.parentNode ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return chain;
}

/**
 * Disarms every press (a tap waiting for its release, a hold being timed) on an element inside `host`, shadow roots
 * included: the panel lost input to a modal above it, so a finger already down on it must not press anything when it lifts.
 */
export function cancelPressesWithin(host: Element): void {
  for (const [element, cancel] of [...tapCancels, ...holdCancels]) {
    if (composedAncestors(element).includes(host)) cancel();
  }
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
    const clips = clippingAncestors(
      offsets.map(([node]) => node),
      element,
    );
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
    // The release arrives here even from outside the element (and pointerleave is suppressed): check where it lifted.
    if (!pointOnControl(element, held.clips, event.clientX, event.clientY)) return;
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
  // A click with no pointer behind it (`detail` 0: the focus route's `click()`, a screen reader's or a keyboard's
  // activation) is a press too. A pointer's own click has `detail` 1 or more and is already handled by `up`.
  const activate = (event: MouseEvent): void => {
    if (event.detail === 0 && options.enabled?.() !== false) handler(event as PointerEvent);
  };
  tapCancels.set(element, end);
  element.addEventListener("click", activate);
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointercancel", end);
  element.addEventListener("pointerleave", end);
  element.addEventListener("lostpointercapture", end);
  return () => {
    end();
    tapCancels.delete(element);
    element.removeEventListener("click", activate);
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointerup", up);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointercancel", end);
    element.removeEventListener("pointerleave", end);
    element.removeEventListener("lostpointercapture", end);
  };
}

/** How long a press lasts before it is a hold, and how far it may wander and still be one: as the client's `view/hold-gesture.ts`. */
export const HOLD_MS = 420;
export const HOLD_SLOP_PX = 12;

/**
 * Calls `handler` for a press-and-hold (the mouse or a finger kept down on `element` for `HOLD_MS`, and within
 * `HOLD_SLOP_PX` of where it began when the timer fires, as the client's `view/hold-gesture.ts` decides: a rolling
 * fingertip still holds) and for a right-click: the gesture a card shares for "look at this" (Inspect). The release
 * that ends a hold that fired never also taps, however long the press lasted after it fired. Returns the function that
 * stops listening.
 */
const holdCancels = new Map<Element, () => void>();

/** Disarms a press on `element` that `onHold` is timing, so its hold never fires (the screen went under a modal). */
export function cancelHold(element: Element): void {
  holdCancels.get(element)?.();
}

export function onHold(element: HTMLElement, handler: (event: Event) => void): () => void {
  let press: {
    id: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    timer: ReturnType<typeof setTimeout>;
    /** Where every element under the press stood: a list can scroll under a held pointer that never moves. */
    offsets: readonly (readonly [Element, number, number])[];
    /** The clipping ancestors the press went through, as `onTap` keeps them. */
    clips: readonly Element[];
  } | null = null;
  /** The pointer whose hold fired and whose release is still to come; cleared by that release or the next press. */
  let fired: number | null = null;
  const end = (): void => {
    if (press) clearTimeout(press.timer);
    press = null;
  };
  const down = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    end();
    fired = null;
    const held = { id: event.pointerId, x: event.clientX, y: event.clientY };
    const offsets = event
      .composedPath()
      .filter((node): node is Element => node instanceof Element)
      .map((node) => [node, node.scrollTop, node.scrollLeft] as const);
    const clips = clippingAncestors(
      offsets.map(([node]) => node),
      element,
    );
    const timer = setTimeout(() => {
      const now = press;
      if (now?.id !== held.id) return;
      press = null;
      // Where the pointer is now, not whether it ever wandered: a wobble that comes back is still a hold.
      if (Math.hypot(now.lastX - now.x, now.lastY - now.y) > HOLD_SLOP_PX) return;
      // The content moved under a still pointer (wheel, trackpad, programmatic scroll): not the card pressed any more.
      if (now.offsets.some(([node, top, left]) => node.scrollTop !== top || node.scrollLeft !== left)) return;
      // A captured touch suppresses pointerleave: a finger that rolled just off the card (within the slop) or out of
      // the scroll viewport that clips it is no longer on the card, so no Inspect.
      if (!pointOnControl(element, now.clips, now.lastX, now.lastY)) return;
      fired = held.id;
      handler(event);
    }, HOLD_MS);
    press = { ...held, lastX: held.x, lastY: held.y, timer, offsets, clips };
  };
  const move = (event: PointerEvent): void => {
    if (press?.id !== event.pointerId) return;
    press.lastX = event.clientX;
    press.lastY = event.clientY;
  };
  // A mouse that leaves the element has left the gesture: its release lands elsewhere, so the hold is off. (A touch
  // press stays captured by the element it began on, so its moves still arrive here and the slop check above decides.)
  const leave = (event: PointerEvent): void => {
    if (press?.id === event.pointerId) end();
  };
  const up = (event: PointerEvent): void => {
    end();
    // The release that ends a hold is not a tap: stopped before the element's tap listener hears it.
    if (fired === event.pointerId && event.button === 0) {
      fired = null;
      event.stopImmediatePropagation();
    }
  };
  const menu = (event: Event): void => {
    event.preventDefault();
    // A long press on a touch screen raises this too, after the hold already fired.
    if (fired !== null) return;
    handler(event);
  };
  holdCancels.set(element, () => {
    end();
    fired = null;
  });
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up, { capture: true });
  element.addEventListener("pointercancel", end);
  element.addEventListener("lostpointercapture", leave);
  element.addEventListener("pointerleave", leave);
  element.addEventListener("contextmenu", menu);
  return () => {
    end();
    holdCancels.delete(element);
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", up, { capture: true });
    element.removeEventListener("pointercancel", end);
    element.removeEventListener("lostpointercapture", leave);
    element.removeEventListener("pointerleave", leave);
    element.removeEventListener("contextmenu", menu);
  };
}
