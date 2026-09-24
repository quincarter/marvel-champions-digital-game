/**
 * The page-based comic reader (`art/README.md`'s "comic reader"): one full comic page at a time, cover-fit to the
 * reading area and re-centered on whichever panel is current, that panel lit and the rest of the page dimmed. Pure
 * *drawing* over `view/comic-reader-model.ts`'s `ComicReaderStepView` — every bit of stepping, labeling and roster
 * fallback logic lives there; this module only turns one resolved step into game objects. Shared today by the issue
 * opener (`scenes/campaign/opener.ts`); any later screen that reads comic pages (The Run, the in-game stage beat,
 * Rewind, the Aftermath, the Finale) draws through the same function over its own `ComicBeatRef` list.
 */
import Phaser from "phaser";
import { coverFit, ensurePictureLoaded } from "../art/pictures.js";
import { accent, border, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import type { ComicReaderStepView } from "../view/comic-reader-model.js";
import { campaignPagePicture, captionBox, speechBubble } from "./campaign-chrome.js";
import { setMask } from "./rex.js";
import { textStyle } from "./theme.js";

/** Below this, a text wrap throws in Phaser (`Text.setWordWrapWidth`) — the same floor `opener.ts` clamps to. */
const MIN_WRAP_WIDTH = 40;

export interface ComicReaderDrawResult {
  /** The current panel's own on-screen rect, clamped to the reading area — null while its page art hasn't loaded. */
  readonly lit: Rect | null;
}

/**
 * Draws one step into `rect`: the page image, the panel spotlight, its caption/lines/SFX, and the beat/page
 * counters. `onReady` is `ensurePictureLoaded`'s redraw hook — called once the page's own art file finishes loading.
 * Returns `{ lit: null }` (and draws only the dark ground) until then, so the caller's next `onReady`-triggered
 * redraw picks the real layout up.
 */
export function drawComicReaderStep(
  scene: Phaser.Scene,
  rect: Rect,
  campaignId: string,
  step: ComicReaderStepView,
  onReady: () => void,
): ComicReaderDrawResult {
  scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
  if (rect.width <= 0 || rect.height <= 0) return { lit: null };

  const picture = campaignPagePicture(campaignId, step.page.file);
  const key = picture ? ensurePictureLoaded(scene, picture, onReady) : null;
  if (!key) return { lit: null };

  const source = scene.textures.get(key).getSourceImage() as { width: number; height: number };
  const fit = coverFit(source, rect);
  const panel = step.panel;
  // Cover-fits the whole page, but centers the crop on the *current panel* rather than the page's own middle —
  // advancing a beat re-centers the crop on the new panel, which reads as the reader panning to it.
  const focusX = clamp01((panel.x + panel.w / 2) / step.page.width);
  const focusY = clamp01((panel.y + panel.h / 2) / step.page.height);
  const cropX = clamp(0, source.width - fit.cropWidth, (source.width - fit.cropWidth) * focusX);
  const cropY = clamp(0, source.height - fit.cropHeight, (source.height - fit.cropHeight) * focusY);
  const imageX = rect.x - cropX * fit.scale;
  const imageY = rect.y - cropY * fit.scale;
  scene.add
    .image(imageX, imageY, key)
    .setOrigin(0, 0)
    .setScale(fit.scale)
    .setCrop(cropX, cropY, fit.cropWidth, fit.cropHeight);

  // The panel's on-screen rect, clamped to `rect` — a full-bleed panel's own page-pixel rect can exceed the visible
  // crop (it *is* the whole page), which then just lands as "the whole visible page is lit" rather than an overlay
  // rect running off both edges.
  const litX = Math.max(rect.x, imageX + panel.x * fit.scale);
  const litY = Math.max(rect.y, imageY + panel.y * fit.scale);
  const litRight = Math.min(rect.x + rect.width, imageX + (panel.x + panel.w) * fit.scale);
  const litBottom = Math.min(rect.y + rect.height, imageY + (panel.y + panel.h) * fit.scale);
  const lit: Rect = { x: litX, y: litY, width: Math.max(0, litRight - litX), height: Math.max(0, litBottom - litY) };

  // Dims everything outside the lit panel: one full-rect dark overlay, inverse-masked to the lit rect
  // (`ui/rex.ts`'s `setMask` — Phaser 4's own `createGeometryMask` is a silent WebGL no-op) rather than four
  // hand-fitted strip rectangles around a rect that moves and resizes every beat and every screen size.
  if (lit.width > 0 && lit.height > 0) {
    const overlay = scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex, 0.72).setOrigin(0, 0);
    const maskShape = scene.make.graphics({}, false);
    maskShape.fillStyle(0xffffff, 1).fillRect(lit.x, lit.y, lit.width, lit.height);
    setMask(overlay, maskShape, "world", true);
    overlay.once(Phaser.GameObjects.Events.DESTROY, () => maskShape.destroy());

    scene.add
      .rectangle(lit.x, lit.y, lit.width, lit.height)
      .setOrigin(0, 0)
      .setStrokeStyle(border.object, surface.paper.hex, 0.95);
  }

  if (lit.width > 0 && lit.height > 0) drawStepContent(scene, rect, lit, step);
  return { lit };
}

function drawStepContent(scene: Phaser.Scene, rect: Rect, lit: Rect, step: ComicReaderStepView): void {
  // Caption: pinned to the reading area's own top edge, like a comic's own caption box overlaid on its art —
  // never covers the panel's readable center regardless of where the panel currently sits.
  let bubbleTop = rect.y + 12;
  if (step.caption) {
    const capWidth = Math.max(MIN_WRAP_WIDTH, Math.min(rect.width - 24, 520));
    const { rect: capRect } = captionBox(scene, rect.x + 12, rect.y + 12, capWidth, step.caption);
    bubbleTop = capRect.y + capRect.height + 10;
  }

  if (step.sfx) {
    scene.add
      .text(
        lit.x + lit.width - 14,
        lit.y + 14,
        step.sfx,
        textStyle({ ...typeRole.barTitle, size: 26 }, accent.heroRed.hex),
      )
      .setOrigin(1, 0)
      .setAngle(-6);
  }

  if (step.lines.length === 0) return;
  const belowRoom = rect.y + rect.height - (lit.y + lit.height) - 16;
  const rightRoom = rect.x + rect.width - (lit.x + lit.width) - 16;
  const bubbleWidth = Math.max(MIN_WRAP_WIDTH, Math.min(360, rightRoom > 160 ? rightRoom : rect.width - 24));

  if (rightRoom > 160) {
    // Room to the panel's right: bubbles stack there, beside the art rather than over it.
    let y = Math.max(bubbleTop, lit.y);
    for (const line of step.lines) {
      const speaker = line.speaker.kind === "hero" || line.speaker.kind === "npc" ? line.speaker.name : undefined;
      const { rect: bubbleRect } = speechBubble(scene, lit.x + lit.width + 12, y, bubbleWidth, line.text, {
        ...(speaker ? { speaker } : {}),
        tail: "left",
        size: 14,
      });
      y = bubbleRect.y + bubbleRect.height + 8;
    }
  } else if (belowRoom > 90) {
    // Room below the panel: bubbles stack there instead.
    let y = lit.y + lit.height + 10;
    for (const line of step.lines) {
      if (y > rect.y + rect.height - 20) break;
      const speaker = line.speaker.kind === "hero" || line.speaker.kind === "npc" ? line.speaker.name : undefined;
      const { rect: bubbleRect } = speechBubble(
        scene,
        lit.x + 10,
        y,
        Math.max(MIN_WRAP_WIDTH, lit.width - 20),
        line.text,
        {
          ...(speaker ? { speaker } : {}),
          tail: "none",
          size: 14,
        },
      );
      y = bubbleRect.y + bubbleRect.height + 8;
    }
  } else {
    // No clear room beside or below the panel (a full-bleed panel filling the reading area): fall back to
    // overlapping its own lower edge, the same last resort the three-panel opener uses for a full-art panel.
    let bottom = lit.y + lit.height - 14;
    for (const line of [...step.lines].reverse()) {
      const speaker = line.speaker.kind === "hero" || line.speaker.kind === "npc" ? line.speaker.name : undefined;
      const overlapWidth = Math.max(MIN_WRAP_WIDTH, lit.width * 0.7);
      const probe = speechBubble(scene, -10000, -10000, overlapWidth, line.text, {
        ...(speaker ? { speaker } : {}),
        tail: "none",
        size: 14,
      });
      const bubbleHeight = probe.rect.height;
      for (const object of probe.objects) object.destroy();
      const bubbleY = bottom - bubbleHeight;
      speechBubble(scene, lit.x + lit.width - 10 - overlapWidth, bubbleY, overlapWidth, line.text, {
        ...(speaker ? { speaker } : {}),
        tail: "none",
        size: 14,
      });
      bottom = bubbleY - 8;
    }
  }
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function clamp01(v: number): number {
  return clamp(0, 1, v);
}
