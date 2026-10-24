/**
 * The "Controller connected" toast's pure parts (`docs/controller-support.md`, On-screen hints): what it says, the
 * once-per-pad rule, where it sits and how it fades. `scenes/pad-toast.ts` draws it; `scenes/pad-toast-watch.ts`
 * feeds it from the browser's gamepad events.
 */
import { detectPad, padFamilyName, resolvePadFamily, type PadFamilySetting } from "./pad-family.js";
import { padDisplayName } from "./controls-rows.js";
import type { Rect } from "./layout.js";

/** How long each notice stays up. */
export const PAD_CONNECTED_MS = 4000;
export const PAD_DISCONNECTED_MS = 3000;

export interface PadToastMessage {
  readonly kind: "connected" | "disconnected";
  /** The small caps line. */
  readonly heading: string;
  /** The line under it: layout and pad name; null on a disconnect. */
  readonly detail: string | null;
  readonly holdMs: number;
  /** A connect carries the Controls button; a disconnect has nothing to open. */
  readonly controlsButton: boolean;
}

/** "Xbox layout · Wireless Controller": the family the player's setting names (else the detected one) and the pad. */
export function padConnectedMessage(id: string, setting: PadFamilySetting): PadToastMessage {
  const family = resolvePadFamily(setting, detectPad(id));
  return {
    kind: "connected",
    heading: "Controller connected",
    detail: `${padFamilyName(family)} layout · ${padDisplayName(id)}`,
    holdMs: PAD_CONNECTED_MS,
    controlsButton: true,
  };
}

export function padDisconnectedMessage(): PadToastMessage {
  return {
    kind: "disconnected",
    heading: "Controller disconnected",
    detail: null,
    holdMs: PAD_DISCONNECTED_MS,
    controlsButton: false,
  };
}

/** Remembers the pads announced this session: a connect is announced once per pad id. */
export class PadAnnounced {
  readonly #seen = new Set<string>();

  /** True the first time `id` is claimed (announce it), false after (stay quiet). */
  claim(id: string): boolean {
    if (this.#seen.has(id)) return false;
    this.#seen.add(id);
    return true;
  }
}

/** Top centre, under the title bar (where the achievement popup's "top" place sits), clear of the action bar below. */
export function padToastRect(width: number, height: number, controlsButton: boolean): Rect {
  const phone = width < 600;
  const margin = phone ? 8 : 16;
  const w = Math.min(controlsButton ? 520 : 380, width - 2 * margin);
  const h = phone && controlsButton ? 96 : 64;
  return { x: Math.round((width - w) / 2), y: Math.min(phone ? 64 : 76, Math.max(0, height - h)), width: w, height: h };
}

export const PAD_TOAST_IN_MS = 180;
export const PAD_TOAST_OUT_MS = 260;

/** One moment of the toast: its alpha, how far it has dropped into place (px above rest), and whether it is over. */
export function padToastFrameAt(
  elapsedMs: number,
  totalMs: number,
  reducedMotion: boolean,
): { readonly alpha: number; readonly lift: number; readonly done: boolean } {
  if (elapsedMs >= totalMs) return { alpha: 0, lift: 0, done: true };
  // Reduced motion: no slide and no fade, it is simply there and then gone.
  if (reducedMotion) return { alpha: 1, lift: 0, done: false };
  if (elapsedMs < PAD_TOAST_IN_MS) {
    const t = elapsedMs / PAD_TOAST_IN_MS;
    return { alpha: t, lift: (1 - t) * 12, done: false };
  }
  const left = totalMs - elapsedMs;
  if (left < PAD_TOAST_OUT_MS) return { alpha: left / PAD_TOAST_OUT_MS, lift: 0, done: false };
  return { alpha: 1, lift: 0, done: false };
}
