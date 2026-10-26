/**
 * Inspect's tap/hold split (`docs/controller-support.md` decision 8, "hold Y to zoom"): a tap on Y (E / O on the
 * keyboard) opens Inspect on the focused card, a hold of `ZOOM_HOLD_MS` shows it enlarged instead (the desktop hover
 * popover), following the focus while the button stays down, and the release closes it without opening Inspect.
 *
 * One machine across the pad and the keyboard: whichever input pressed first owns the hold, so the other's press is
 * ignored meanwhile and a key's auto-repeat (a second press with the first still down) never restarts it. Pure, with
 * the clock passed in; `view/pad-hold-tap.ts` supplies the tap/hold timing.
 */
import { createHoldTap } from "./pad-hold-tap.js";
import type { Rect } from "./layout.js";

export const ZOOM_HOLD_MS = 300;

export type InspectSource = "pad" | "key";

export interface InspectHold {
  /** A press; false when it was ignored (another input holds Inspect, or this is a key repeat). */
  press(source: InspectSource, now: number): boolean;
  /** Call each frame: "zoom" once when the hold has lasted `ZOOM_HOLD_MS`, else null. */
  poll(now: number): "zoom" | null;
  /**
   * A release. "inspect" for a tap (open Inspect), "close" for the release of a hold that had zoomed, else null (not the
   * holder's release).
   */
  release(source: InspectSource, now: number): "inspect" | "close" | null;
  /** The screen was blocked meanwhile: forget the press. "close" when a zoom was showing. */
  cancel(): "close" | null;
  /** True while the zoom is showing. */
  readonly zooming: boolean;
}

export function createInspectHold(holdMs: number = ZOOM_HOLD_MS): InspectHold {
  const timing = createHoldTap(holdMs);
  let holder: InspectSource | null = null;
  let zooming = false;
  return {
    press(source, now) {
      if (holder !== null) return false;
      holder = source;
      zooming = false;
      timing.press(now);
      return true;
    },
    poll(now) {
      if (holder === null || zooming) return null;
      if (timing.poll(now) !== "hold") return null;
      zooming = true;
      return "zoom";
    },
    release(source, now) {
      if (holder !== source) return null;
      holder = null;
      const wasZooming = zooming;
      zooming = false;
      // A release the frame loop never polled (a long hold between two frames) still counts as the hold.
      if (timing.release(now) === "tap") return "inspect";
      return wasZooming ? "close" : null;
    },
    cancel() {
      const wasZooming = zooming;
      holder = null;
      zooming = false;
      timing.cancel();
      return wasZooming ? "close" : null;
    },
    get zooming() {
      return zooming;
    },
  };
}

/**
 * Where the pinned popover's top-left goes: beside the focused card (its right, or its left when the enlarged card
 * would run off the area), centred on it vertically, clamped inside the area.
 */
export function zoomPlacement(
  card: Rect,
  size: { readonly width: number; readonly height: number },
  area: Rect,
  gap = 22,
  margin = 8,
): { x: number; y: number } {
  const left = area.x + margin;
  const right = area.x + area.width - margin;
  const top = area.y + margin;
  const bottom = area.y + area.height - margin;
  const beside = card.x + card.width + gap;
  let x = beside + size.width <= right ? beside : card.x - gap - size.width;
  let y = card.y + card.height / 2 - size.height / 2;
  x = Math.max(left, Math.min(x, Math.max(left, right - size.width)));
  y = Math.max(top, Math.min(y, Math.max(top, bottom - size.height)));
  return { x, y };
}

/** The card the zoom shows: the focused card while the zoom is open, else nothing. */
export function zoomCardOf<Focus extends { readonly kind: string }>(
  zooming: boolean,
  focus: Focus | null,
  logFocused: boolean,
): (Focus & { readonly kind: "card" }) | null {
  return zooming && !logFocused && focus?.kind === "card" ? (focus as Focus & { readonly kind: "card" }) : null;
}
