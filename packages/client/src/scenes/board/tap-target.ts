/**
 * The table's card gesture: a tap acts; a press-and-hold or a right-click
 * inspects.
 *
 * The table's primary gesture has to stay "tap the thing you mean", so
 * Inspect takes the second gesture rather than a chrome button per card. The
 * hold threshold is `INSPECT_HOLD_MS`: long enough that a decisive tap never
 * opens a sheet, short enough to feel deliberate.
 */

import type Phaser from "phaser";
import type { Rect } from "../../view/layout.js";

/**
 * How long a press has to last before it inspects instead of acting. Below
 * this, a tap is a tap; above it, the player clearly meant to look.
 */
const INSPECT_HOLD_MS = 420;

/**
 * How far a pointer has to move, in pixels, before a press on a card in a
 * scrollable row (the tabbed hand) reads as a drag rather than the start of a
 * tap or a hold. Below this, a slightly unsteady tap still taps.
 */
const DRAG_THRESHOLD_PX = 8;

export interface TapGesture {
  /** A release that was not a hold, a right-click or a drag. */
  onTap(): void;
  onInspect(): void;
  /**
   * When given, a horizontal drag starting on this card scrolls instead of
   * tapping — the tabbed hand's cards are the only tap targets that ever sit
   * inside a scrollable row, so every other caller simply never passes it.
   */
  onDrag?: ((deltaX: number) => void) | undefined;
}

export function addTapTarget(scene: Phaser.Scene, rect: Rect, gesture: TapGesture): void {
  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });

  let held: Phaser.Time.TimerEvent | null = null;
  let inspected = false;
  let dragging = false;
  let downX = 0;
  const cancelHold = (): void => {
    held?.remove();
    held = null;
  };

  zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    inspected = false;
    dragging = false;
    downX = pointer.x;
    if (pointer.rightButtonDown()) {
      inspected = true;
      gesture.onInspect();
      return;
    }
    held = scene.time.delayedCall(INSPECT_HOLD_MS, () => {
      inspected = true;
      gesture.onInspect();
    });
  });
  const { onDrag } = gesture;
  if (onDrag) {
    zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || inspected) return;
      if (!dragging && Math.abs(pointer.x - downX) < DRAG_THRESHOLD_PX) return;
      // Once a gesture reads as a drag it stays one for its whole length —
      // a hold that was about to fire would otherwise still open Inspect
      // out from under a scroll the player is mid-way through.
      dragging = true;
      cancelHold();
      onDrag(pointer.x - pointer.prevPosition.x);
    });
  }
  zone.on("pointerout", cancelHold);
  zone.on("pointerup", () => {
    cancelHold();
    // A hold or a drag already did something; the release must not also act on it.
    if (inspected || dragging) return;
    gesture.onTap();
  });
}
