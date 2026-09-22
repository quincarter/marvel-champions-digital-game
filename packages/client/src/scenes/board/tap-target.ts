/**
 * The table's card gesture: a tap acts; a press-and-hold or a right-click
 * inspects.
 *
 * The table's primary gesture has to stay "tap the thing you mean", so
 * Inspect takes the second gesture rather than a chrome button per card. The
 * rules of the gesture — the hold threshold, how far a finger may wander —
 * live in `view/hold-gesture.ts`; `ui/hold-target.ts` wires them to a zone.
 */

import type Phaser from "phaser";
import type { Rect } from "../../view/layout.js";
import { bindHoldTarget } from "../../ui/hold-target.js";

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
  /** With `onDrag`: the drag ended at this speed (px/ms), for a row that coasts after a flick. */
  onDragEnd?: ((velocityPxPerMs: number) => void) | undefined;
  /**
   * The card's instance id. The board redraws under a finger that is still
   * down, and this is how the recreated target knows the press is its own.
   */
  key?: string | undefined;
}

export function addTapTarget(scene: Phaser.Scene, rect: Rect, gesture: TapGesture): void {
  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  bindHoldTarget(scene, zone, gesture);
}
