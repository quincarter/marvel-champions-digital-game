/**
 * Wires a Phaser zone to the shared card gesture (`view/hold-gesture.ts`):
 * tap acts, press-and-hold or right-click inspects, and a sideways drag
 * scrolls when the caller says the zone sits in a scrollable row.
 *
 * One binder for the table's cards (`scenes/board/tap-target.ts`), the choice
 * sheet's option rows (`scenes/choice.ts`) and `McCardTile` (`ui/widgets.ts`),
 * which used to carry three copies of the same timer-and-flags code — and the
 * same phone bug in each.
 *
 * **A press outlives the zone it began on.** The board redraws whole on every
 * state change, every art arrival and every pixel the hand scrolls
 * (`HandScroll#scrollBy`), and a redraw destroys and recreates every zone —
 * under a finger that is still down. A gesture kept in the zone's own closure
 * therefore forgot itself mid-press: a hand scroll only kept going by
 * accident, and lifting the finger at the end of one tapped whichever card had
 * arrived under it. So the live press is kept per pointer, outside any zone,
 * and a zone that receives the rest of a press it never saw begin picks it up
 * from there: a drag carries on across whatever cards pass under it, and a
 * press is only ever a tap on a control with the same `key` it began on.
 */

import type Phaser from "phaser";
import { HoldGesture, INSPECT_HOLD_MS } from "../view/hold-gesture.js";

export interface HoldTargetHandlers {
  /** A release that was not a hold, a right-click, a drag or a cancelled touch. */
  onTap(): void;
  /** Absent when there is nothing to read; the press is then only ever a tap. */
  onInspect?: (() => void) | undefined;
  /** When given, a horizontal drag starting here scrolls instead of tapping. */
  onDrag?: ((deltaX: number) => void) | undefined;
  /**
   * What this control *is*, stable across redraws — a card's instance id.
   * Without one, a zone recreated mid-press cannot tell it is the same control
   * and the press's release is not a tap.
   */
  key?: string | undefined;
}

interface LivePress {
  /** `Pointer#downTime` of the press this is, so a later press never inherits it. */
  readonly downTime: number;
  readonly key: string | undefined;
  readonly gesture: HoldGesture;
}

const livePresses = new WeakMap<Phaser.Input.Pointer, LivePress>();

export function bindHoldTarget(scene: Phaser.Scene, zone: Phaser.GameObjects.Zone, handlers: HoldTargetHandlers): void {
  const { onInspect, onDrag, key } = handlers;

  /** The press that began on this very zone, which it always has a claim on. */
  let own: HoldGesture | null = null;

  /** The press in progress on `pointer`, when this zone has a claim on it. */
  const claim = (pointer: Phaser.Input.Pointer): HoldGesture | null => {
    const press = livePresses.get(pointer);
    if (!press || press.downTime !== pointer.downTime) return null;
    // An undecided press belongs to the control it began on. One that has
    // already become a drag or a hold belongs to that, wherever it ends.
    if (press.gesture.undecided && press.gesture !== own && (key === undefined || press.key !== key)) return null;
    return press.gesture;
  };

  zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    const gesture = new HoldGesture({ canInspect: onInspect !== undefined, canDrag: onDrag !== undefined });
    own = gesture;
    livePresses.set(pointer, { downTime: pointer.downTime, key, gesture });
    const began = gesture.down(pointer.x, pointer.y, pointer.rightButtonDown());
    if (began === "inspect") onInspect?.();
    if (began !== "arm") return;
    // Deliberately not cancelled on `pointerout` — on a touch screen that fires
    // for a thumb rolling a few pixels past a card's edge — nor when this zone
    // is destroyed by a redraw. Whether the press is still a hold is decided
    // when the timer fires, from where the pointer is then.
    const { downTime } = pointer;
    scene.time.delayedCall(INSPECT_HOLD_MS, () => {
      const stillDown = pointer.isDown && pointer.downTime === downTime;
      if (gesture.holdElapsed(pointer.x, pointer.y, stillDown)) onInspect?.();
    });
  });
  if (onDrag) {
    zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      if (claim(pointer)?.move(pointer.x)) onDrag(pointer.x - pointer.prevPosition.x);
    });
  }
  zone.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    const gesture = claim(pointer);
    livePresses.delete(pointer);
    if (gesture?.up(pointer.wasCanceled)) handlers.onTap();
  });
}
