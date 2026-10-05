/**
 * Makes an overlay's pointer shield hit-testable the moment it is made, not a frame later.
 *
 * Phaser's input plugin queues a newly interactive object and only merges the queue into the list it hit-tests at the
 * start of the NEXT frame (`InputPlugin#preUpdate`), while the browser's pointer events are handled the instant they
 * arrive. An overlay that redraws (a step change, an art arrival) builds its full-screen shield zone anew, and for as
 * long as a frame lasts there is no shield: at 60 fps 16 ms, on a slow device (a phone at 10 fps, software rendering at
 * 1 fps) a tenth of a second to a second. A press in that window falls through to the table underneath: it pressed a
 * hand card, or opened Pause, behind the villain-phase recap (seen on a starved CI runner, `overlay-input-block`).
 *
 * So a shield joins the live list when it is made. Only shields: every other control relies on the tap router
 * (`ui/tap.ts`) for the same window, and making all zones hittable at once changes how a press that straddles a redraw
 * reaches them. The list is replaced rather than mutated, so a hit test already in progress keeps the one it started with.
 */
import type Phaser from "phaser";

/** The two lists of an input plugin that matter here (Phaser keeps them private-by-convention). */
export interface InputLists<T> {
  _list: T[];
  _pendingInsertion: T[];
}

/** Adds `child` to the plugin's live hit-test list now, unless it is already there. */
export function insertAtOnce<T>(plugin: InputLists<T>, child: T): void {
  if (plugin._list.includes(child)) return;
  const queued = plugin._pendingInsertion.indexOf(child);
  if (queued >= 0) plugin._pendingInsertion.splice(queued, 1);
  plugin._list = plugin._list.concat(child);
}

/** A full-screen interactive zone that takes every press that reaches it, hittable from the moment it exists. */
export function addPressShield(
  scene: Phaser.Scene,
  rect: { x: number; y: number; width: number; height: number },
): Phaser.GameObjects.Zone {
  const zone = scene.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive();
  insertAtOnce(scene.input as unknown as InputLists<unknown>, zone);
  return zone;
}
