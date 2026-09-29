/**
 * The compact bottom guide strip (guided mode G7c, `docs/guided-mode.md` §4 "Left for G7"): a single yellow band
 * pinned to the bottom of the villain-phase walkthrough (`scenes/villain-phase.ts`) or the defend choice sheet
 * (`scenes/choice.ts`) on a tabbed form factor — both overlays cover the whole canvas there, which used to hide
 * `McGuideCallout` (and lesson 4's own copy) entirely (guided-phone.dc's own P05: a yellow strip with the `GUIDE`
 * stamp, the step's short line, and the two §3.10 exits, never the full callout — there's no room for its
 * title/body/step-label inside either overlay's own layout at 390px).
 *
 * Deliberately not `McGuideCallout`: this is the one guide surface with no anchor, no arrow, and no title — a
 * single line plus two exits, drawn straight into the host scene rather than as a reusable widget class, since
 * neither host keeps a persistent instance across redraws (both scenes already tear down and rebuild their whole
 * display list every time, `scenes/board/guide-mount.ts`'s own header explains why that's the rule here).
 */
import type Phaser from "phaser";
import { border, hit, signal, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { textStyle } from "./theme.js";

/** The strip's own fixed height — pinned at the very bottom, above nothing else. Tall enough for the step text to
 * wrap to three lines rather than being silently cut (found in browser verification: a two-line cap dropped the
 * tail of a step's own `short` copy with no ellipsis). */
export const GUIDE_STRIP_HEIGHT = 72;

export interface GuideStripContent {
  /** The current step's own one-line text (`GuideControllerView.stripText`). */
  readonly text: string;
  readonly onSkip: () => void;
  readonly onStop: () => void;
}

/** Draws the strip at `rect` into `scene`'s current display list — every object it creates is torn down the same
 * way the rest of that scene's own redraw already tears its children down, so nothing here outlives one frame. */
export function drawGuideStrip(scene: Phaser.Scene, rect: Rect, content: GuideStripContent): void {
  const g = scene.add.graphics();
  g.fillStyle(signal.caution.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.lineStyle(border.object, surface.ink.hex, 1);
  g.strokeRect(rect.x, rect.y, rect.width, rect.height);

  const pad = 12;
  const cy = rect.y + rect.height / 2;

  // Measured before anything is drawn, so the box can be sized to the label without the label having to be
  // reparented on top of it after the fact — `scene.add.*` stacks strictly in call order.
  const stampMeasure = scene.add
    .text(0, 0, "GUIDE", textStyle({ ...typeRole.label, size: 10 }, surface.paper.hex))
    .setVisible(false);
  const stampPad = 8;
  const stampHeight = 20;
  const stampWidth = stampMeasure.width + stampPad * 2;
  stampMeasure.destroy();
  scene.add
    .graphics()
    .fillStyle(surface.ink.hex, 1)
    .fillRect(rect.x + pad, cy - stampHeight / 2, stampWidth, stampHeight);
  scene.add
    .text(rect.x + pad + stampPad, cy, "GUIDE", textStyle({ ...typeRole.label, size: 10 }, surface.paper.hex))
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);

  // Skip/Stop, right-aligned — "Skip this step" spelled out and a boxed × for "Stop tutorial", the same split
  // `McGuideCallout`'s own phone-width exits row uses (`ui/guide-callout.ts`'s own header: no room to spell both
  // out at this width).
  const stopLabel = scene.add
    .text(0, 0, "×", { ...textStyle({ ...typeRole.label, size: 10 }, surface.ink.hex), fontSize: "20px" })
    .setOrigin(0.5, 0.5);
  const stopWidth = Math.max(hit.target, stopLabel.width + 16);
  stopLabel.setPosition(rect.x + rect.width - pad - stopWidth / 2, cy);
  const stopZone = scene.add
    .zone(rect.x + rect.width - pad - stopWidth, rect.y, stopWidth, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  stopZone.on("pointerup", () => content.onStop());

  const skipLabel = scene.add
    .text(0, 0, "Skip", textStyle({ ...typeRole.label, size: 12 }, surface.ink.hex))
    .setOrigin(0.5, 0.5);
  const skipWidth = Math.max(hit.target, skipLabel.width + 16);
  const skipX = rect.x + rect.width - pad - stopWidth - 8 - skipWidth;
  skipLabel.setPosition(skipX + skipWidth / 2, cy);
  const skipZone = scene.add
    .zone(skipX, rect.y, skipWidth, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  skipZone.on("pointerup", () => content.onSkip());

  const textX = rect.x + pad + stampWidth + 10;
  const textWidth = Math.max(40, skipX - 8 - textX);
  scene.add
    .text(textX, cy, content.text, textStyle(typeRole.body, surface.ink.hex))
    .setOrigin(0, 0.5)
    .setWordWrapWidth(textWidth)
    .setMaxLines(3);
}
