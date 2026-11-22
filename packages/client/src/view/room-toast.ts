/**
 * The room join toast's pure parts (issue #880): the queue of notices (at most three stacked, each up about four
 * seconds, dismissable), where each sits at each screen size and how it slides in and fades. `scenes/room-toast.ts`
 * draws it; `scenes/room-notice-watch.ts` feeds it from the room's state.
 */
import type { Rect } from "./layout.js";
import type { ParticipantChange } from "./room-notices.js";

/** How long a toast stays up, and how many stack. */
export const ROOM_TOAST_MS = 4000;
export const ROOM_TOAST_MAX = 3;

export interface RoomToast {
  readonly id: number;
  readonly change: ParticipantChange;
  /** When it was shown (ms on the clock the caller passes in). */
  readonly shownAt: number;
}

/** The toasts on screen, newest first. A fourth pushes the oldest out; time and the player take the rest away. */
export class RoomToastQueue {
  #toasts: RoomToast[] = [];
  #nextId = 1;
  readonly #listeners = new Set<() => void>();

  get toasts(): readonly RoomToast[] {
    return this.#toasts;
  }

  /** Shows a change; a person leaving who has a toast up for joining replaces it rather than stacking a second line. */
  push(change: ParticipantChange, now: number): void {
    const rest = this.#toasts.filter((t) => t.change.id !== change.id);
    this.#toasts = [{ id: this.#nextId++, change, shownAt: now }, ...rest].slice(0, ROOM_TOAST_MAX);
    this.#changed();
  }

  /** Removes toasts whose time is up. True when any went. */
  expire(now: number): boolean {
    const kept = this.#toasts.filter((t) => now - t.shownAt < ROOM_TOAST_MS);
    if (kept.length === this.#toasts.length) return false;
    this.#toasts = kept;
    this.#changed();
    return true;
  }

  dismiss(id: number): void {
    const kept = this.#toasts.filter((t) => t.id !== id);
    if (kept.length === this.#toasts.length) return;
    this.#toasts = kept;
    this.#changed();
  }

  /** The keyboard's and the pad's dismiss: the newest toast, the one on top. */
  dismissTop(): void {
    const top = this.#toasts[0];
    if (top) this.dismiss(top.id);
  }

  clear(): void {
    if (this.#toasts.length === 0) return;
    this.#toasts = [];
    this.#changed();
  }

  /** Calls `listener` whenever the set of toasts changes. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #changed(): void {
    for (const listener of [...this.#listeners]) listener();
  }
}

/** The one queue the app uses. */
export const roomToasts = new RoomToastQueue();

export const ROOM_TOAST_HEIGHT = 60;
const GAP = 8;

/** The strip each toast is drawn on at this screen size, newest first (index 0 on top). */
export function roomToastRects(width: number, count: number): Rect[] {
  const phone = width < 600;
  const margin = phone ? 8 : 16;
  const w = phone ? width - 2 * margin : Math.min(340, width - 2 * margin);
  // Under the top bar, where the other notices sit (`view/pad-toast.ts`).
  const top = phone ? 64 : 76;
  const x = phone ? margin : width - margin - w;
  return Array.from({ length: count }, (_, i) => ({
    x,
    y: top + i * (ROOM_TOAST_HEIGHT + GAP),
    width: w,
    height: ROOM_TOAST_HEIGHT,
  }));
}

export const ROOM_TOAST_IN_MS = 220;
export const ROOM_TOAST_OUT_MS = 260;

/**
 * One moment of a toast: its alpha and how far it still has to slide into place (0 at rest, 1 fully off to the side;
 * a phone's toasts come down from above instead, the scene reads which). Reduced motion: no slide, no fade.
 */
export function roomToastFrameAt(
  elapsedMs: number,
  reducedMotion: boolean,
): { readonly alpha: number; readonly slide: number } {
  if (reducedMotion) return { alpha: 1, slide: 0 };
  if (elapsedMs < ROOM_TOAST_IN_MS) {
    const t = Math.max(0, elapsedMs) / ROOM_TOAST_IN_MS;
    return { alpha: t, slide: (1 - t) * (1 - t) };
  }
  const outStart = ROOM_TOAST_MS - ROOM_TOAST_OUT_MS;
  if (elapsedMs > outStart) {
    return { alpha: Math.max(0, 1 - (elapsedMs - outStart) / ROOM_TOAST_OUT_MS), slide: 0 };
  }
  return { alpha: 1, slide: 0 };
}
