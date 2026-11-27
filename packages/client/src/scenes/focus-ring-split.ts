import type Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { McSelectionRing } from "../ui/widgets.js";
import type { FocusRing } from "./focus-route.js";

/**
 * A `FocusRoute` `ring` for a screen that draws some of its stops in Phaser and some in a DOM panel (the villain phase,
 * whose own panel is the game log while the log is up): the DOM ring while `inDom()` says the focused stop is on the
 * panel, `McSelectionRing` otherwise.
 */
export function splitFocusRing(scene: Phaser.Scene, color: number | undefined, inDom: () => boolean): FocusRing {
  const phaser = new McSelectionRing(scene, color, true);
  const dom = domFocusRing(scene, color);
  let active: FocusRing = phaser;
  return {
    show(rect, mode, reducedMotion) {
      active = inDom() ? dom : phaser;
      (active === dom ? phaser : dom).hide();
      active.show(rect, mode, reducedMotion);
    },
    hide() {
      phaser.hide();
      dom.hide();
    },
    destroy() {
      phaser.destroy();
      dom.destroy();
    },
    get graphics() {
      return active.graphics;
    },
  };
}
