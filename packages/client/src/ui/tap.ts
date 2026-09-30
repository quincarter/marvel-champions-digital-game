/**
 * `onTap`: a plain zone's tap, for the controls that aren't a `McButton` but still need `McButton`'s own guard —
 * a press and a release both seen by this zone, within the tap slop (`view/press-arm.ts`). A bare `pointerup`
 * listener fires for any release over the zone, including the end of a scroll that merely lifted there.
 */
import type Phaser from "phaser";
import { PressArm } from "../view/press-arm.js";

export function onTap(zone: Phaser.GameObjects.Zone, activate: (pointer: Phaser.Input.Pointer) => void): void {
  const press = new PressArm();
  zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => press.down(pointer.x, pointer.y));
  zone.on("pointerout", () => press.cancel());
  zone.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    if (press.up(pointer.x, pointer.y)) activate(pointer);
  });
}
