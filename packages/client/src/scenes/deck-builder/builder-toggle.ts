/**
 * The dark mode toggle's press area is cut out of the panel, so words under it are cut off: the title drops below it or
 * ends before it (`sheetThemeFor`). Measured on the title set on one line (it does not depend on what is applied).
 */
import type Phaser from "phaser";
import { sheetThemeFor } from "../../ui/campaign-chrome.js";
import type { McDeckBuilderPage } from "../../views/deck-builder/mc-deck-builder-page/mc-deck-builder-page.js";
import type { DomRegion } from "../../dom/dom-region.js";

/** The Back button's width and the gap before it: the words end before them. */
const BACK = 116;

export function clearToggle(
  scene: Phaser.Scene,
  region: DomRegion<McDeckBuilderPage>,
  element: McDeckBuilderPage,
  phone: boolean,
): void {
  const header = element.headerElement;
  const ghost = header?.ghost;
  if (!header || !ghost) return;
  const row = region.rectOf(header);
  const words = region.rectOf(ghost);
  const plan = sheetThemeFor(scene, {
    width: scene.scale.gameSize.width,
    textLeft: row.x,
    textRight: row.x + Math.min(words.width, Math.max(0, row.width - BACK)),
    textTop: row.y,
    textHeight: words.height || (phone ? 28 : 38),
  });
  const max = plan.maxRight === null ? 0 : Math.max(80, plan.maxRight - row.x);
  if (element.titleDrop !== plan.drop || element.titleMax !== max) {
    element.titleDrop = plan.drop;
    element.titleMax = max;
  }
}
