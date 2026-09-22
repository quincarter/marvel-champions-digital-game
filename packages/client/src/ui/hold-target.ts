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
  /** The drag ended at this speed (px/ms, signed like `onDrag`'s delta) — what a flick coasts from. */
  onDragEnd?: ((velocityPxPerMs: number) => void) | undefined;
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
  const { onInspect, onDrag, onDragEnd, key } = handlers;

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
    if (onDrag) followDrag(scene, pointer, gesture, onDrag, onDragEnd);
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
  zone.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    const gesture = claim(pointer);
    livePresses.delete(pointer);
    if (gesture?.up(pointer.wasCanceled)) handlers.onTap();
  });
}

/**
 * Follows one press's drag from the scene, not from the zone it began on.
 *
 * A zone only hears `pointermove` while the pointer is over it. Fed from the zones, a hand scroll stopped dead the
 * moment a thumb drifted a few pixels above or below the row, or out past the last card, and picked up again — with
 * a lurch — when it wandered back: swiping left, right and left again on a phone read as the row locking up. The
 * scene hears every move wherever it lands, so the row follows the finger for the whole press, and the listeners go
 * away with the release (or with the scene: `InputPlugin` drops every listener on shutdown).
 */
function followDrag(
  scene: Phaser.Scene,
  pointer: Phaser.Input.Pointer,
  gesture: HoldGesture,
  onDrag: (deltaX: number) => void,
  onDragEnd: ((velocityPxPerMs: number) => void) | undefined,
): void {
  const { downTime } = pointer;
  const stop = (): void => {
    scene.input.off("pointermove", move);
    scene.input.off("pointerup", end);
    scene.input.off("pointerupoutside", end);
  };
  const move = (moved: Phaser.Input.Pointer): void => {
    if (moved !== pointer) return;
    // A later press on the same pointer is someone else's; this one ended somewhere nobody told us about.
    if (pointer.downTime !== downTime || !pointer.isDown) return stop();
    const delta = gesture.dragDelta(pointer.x, scene.time.now);
    if (delta) onDrag(delta);
  };
  const end = (released: Phaser.Input.Pointer): void => {
    if (released !== pointer) return;
    stop();
    // The zone's own `pointerup` has already run by now (Phaser tells game objects before the scene); the gesture
    // remembers having been a drag past its own `up` for exactly this question.
    const velocity = gesture.releaseVelocity(scene.time.now);
    if (velocity !== 0) onDragEnd?.(velocity);
  };
  scene.input.on("pointermove", move);
  scene.input.on("pointerup", end);
  scene.input.on("pointerupoutside", end);
}
