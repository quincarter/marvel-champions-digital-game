/**
 * The table's card gesture: a tap acts; a press-and-hold or a right-click
 * inspects.
 *
 * The table's primary gesture has to stay "tap the thing you mean", so
 * Inspect takes the second gesture rather than a chrome button per card. The
 * rules of the gesture — the hold threshold, how far a finger may wander —
 * live in `view/hold-gesture.ts`; `ui/hold-target.ts` wires them to a zone.
 */

import Phaser from "phaser";
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
  /** When given, a mouse moving onto (true) or off (false) the card; never a touch, which has no hover. */
  onHover?: ((over: boolean) => void) | undefined;
  /**
   * The on-screen area the card is clipped to, when it sits in a clipped strip (the phone's sideways hand). A mask
   * hides what is outside it but does not stop presses there: without this, a hand card scrolled under the payment's
   * pinned table cards took the tap meant for them.
   */
  clip?: Rect | undefined;
}

export function addTapTarget(scene: Phaser.Scene, rect: Rect, gesture: TapGesture): void {
  const zone = scene.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0);
  const { clip } = gesture;
  if (clip) {
    // Hit-tested where the zone is now: the strip it is reparented into moves it as the row scrolls.
    zone.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, rect.width, rect.height),
      hitAreaCallback: (area: Phaser.Geom.Rectangle, x: number, y: number) => {
        if (!Phaser.Geom.Rectangle.Contains(area, x, y)) return false;
        const at = zone.getWorldTransformMatrix();
        const worldX = at.tx + x;
        const worldY = at.ty + y;
        return worldX >= clip.x && worldX <= clip.x + clip.width && worldY >= clip.y && worldY <= clip.y + clip.height;
      },
      useHandCursor: true,
    });
  } else zone.setInteractive({ useHandCursor: true });
  bindHoldTarget(scene, zone, gesture);
  const { onHover } = gesture;
  if (onHover) {
    zone
      .on("pointerover", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch) onHover(true);
      })
      .on("pointerout", () => onHover(false));
  }
}
