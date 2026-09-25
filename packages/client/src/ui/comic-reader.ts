/**
 * The page-based comic reader (`art/README.md`'s "comic reader"): one full comic page at a time, cover-fit to the
 * reading area and re-centered on whichever panel is current, that panel lit and the rest of the page dimmed. Pure
 * *drawing* over `view/comic-reader-model.ts`'s `ComicReaderStepView` — every bit of stepping, labeling and roster
 * fallback logic lives there; this module only turns one resolved step into game objects. Shared today by the issue
 * opener (`scenes/campaign/opener.ts`); any later screen that reads comic pages (The Run, the in-game stage beat,
 * Rewind, the Aftermath, the Finale) draws through the same function over its own `ComicBeatRef` list.
 */
import Phaser from "phaser";
import { coverFit, ensurePictureLoaded, type Picture } from "../art/pictures.js";
import { accent, border, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import type { ComicBeat } from "../campaign/story.js";
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
 * A guided-view pan/zoom in progress (`opener.ts` drives this off a Phaser tween): the panel the reader is
 * moving *from*, and how far along (0 at the previous panel, 1 at `step.panel`) the camera is. Ignored for a
 * non-lettered page (GMW's own cover-fit/spotlight draw never reads it).
 */
export interface ComicReaderTween {
  readonly fromPanel: ComicBeat["panel"];
  readonly progress: number;
}

/**
 * Draws one step into `rect`.
 *
 * A **lettered** page (`step.page.lettered`, MC10's official rulebook pages) is drawn as a guided view: the
 * reading area is zoomed to the current panel's own bounds — fit inside the frame, never cover-cropped, so a
 * tall or wide panel letterboxes instead of losing its edges (and any balloon printed near them) — with no
 * caption/line/SFX overlay of the reader's own, because the panel's printed lettering already carries the beat.
 * `tween` interpolates the camera between the previous panel and this one for a smooth pan/zoom; omitted (or a
 * `fromPanel` on a different page) draws the step at rest.
 *
 * An unlettered page (GMW today) keeps its original draw: the whole page cover-fit to `rect`, recentered on the
 * current panel, that panel spotlit and dimmed elsewhere, with the reader's own caption/bubbles/SFX over it —
 * `tween` is ignored for this path so GMW's reader is unchanged.
 *
 * `onReady` is `ensurePictureLoaded`'s redraw hook — called once the page's own art file finishes loading. Returns
 * `{ lit: null }` (and draws only the dark ground) until then, so the caller's next `onReady`-triggered redraw
 * picks the real layout up.
 */
export function drawComicReaderStep(
  scene: Phaser.Scene,
  rect: Rect,
  campaignId: string,
  step: ComicReaderStepView,
  onReady: () => void,
  tween?: ComicReaderTween,
): ComicReaderDrawResult {
  return drawComicReaderPicture(scene, rect, campaignPagePicture(campaignId, step.page.file), step, onReady, tween);
}

/**
 * `drawComicReaderStep` over a picture the caller already resolved — a one-off scenario's intro artboard
 * (`campaign/scenario-intros.ts`) lives under `art/scenarios/`, not a campaign's `pages/`.
 */
export function drawComicReaderPicture(
  scene: Phaser.Scene,
  rect: Rect,
  picture: Picture | null,
  step: ComicReaderStepView,
  onReady: () => void,
  tween?: ComicReaderTween,
): ComicReaderDrawResult {
  scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
  if (rect.width <= 0 || rect.height <= 0) return { lit: null };

  const key = picture ? ensurePictureLoaded(scene, picture, onReady) : null;
  if (!key) return { lit: null };

  const source = scene.textures.get(key).getSourceImage() as { width: number; height: number };
  if (step.page.lettered) return drawGuidedStep(scene, rect, key, source, step, tween);
  return drawSpotlightStep(scene, rect, key, source, step);
}

/** GMW's own draw, unchanged: cover-fit the whole page, recenter on the current panel, spotlight and dim, then
 * the reader's own caption/lines/SFX. */
function drawSpotlightStep(
  scene: Phaser.Scene,
  rect: Rect,
  key: string,
  source: { width: number; height: number },
  step: ComicReaderStepView,
): ComicReaderDrawResult {
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

/**
 * The guided view for a lettered page: zoom to the current panel's own bounds (interpolated from the previous
 * panel while `tween` is in flight), fit inside `rect` rather than cover-cropped, letterboxed on whichever axis
 * doesn't match the frame's own aspect. No dimming, no spotlight border, no caption/lines/SFX — the panel's
 * printed lettering is the whole of what a step shows.
 */
function drawGuidedStep(
  scene: Phaser.Scene,
  rect: Rect,
  key: string,
  source: { width: number; height: number },
  step: ComicReaderStepView,
  tween: ComicReaderTween | undefined,
): ComicReaderDrawResult {
  const panel =
    tween && tween.fromPanel !== step.panel
      ? lerpPanel(tween.fromPanel, step.panel, clamp01(tween.progress))
      : step.panel;

  // Fit-not-cover: scaled so the *panel* (not the page) fits entirely inside `rect`, letterboxed on the axis that
  // doesn't match — never cropped to cover, so a balloon flush against a panel's own edge is never cut off.
  const scale = Math.min(rect.width / Math.max(1, panel.w), rect.height / Math.max(1, panel.h));
  const drawWidth = panel.w * scale;
  const drawHeight = panel.h * scale;
  const offsetX = rect.x + (rect.width - drawWidth) / 2;
  const offsetY = rect.y + (rect.height - drawHeight) / 2;

  const cropX = clamp(0, Math.max(0, source.width - 1), panel.x);
  const cropY = clamp(0, Math.max(0, source.height - 1), panel.y);
  const cropWidth = clamp(1, source.width - cropX, panel.w);
  const cropHeight = clamp(1, source.height - cropY, panel.h);
  scene.add
    .image(offsetX - cropX * scale, offsetY - cropY * scale, key)
    .setOrigin(0, 0)
    .setScale(scale)
    .setCrop(cropX, cropY, cropWidth, cropHeight);

  const lit: Rect = { x: offsetX, y: offsetY, width: drawWidth, height: drawHeight };
  return { lit };
}

/** Linear interpolation between two panel rects — used only while the same page's camera is panning between
 * two of its own panels (a page change never tweens; see `opener.ts`). */
function lerpPanel(from: ComicBeat["panel"], to: ComicBeat["panel"], t: number): ComicBeat["panel"] {
  return {
    x: lerpNum(from.x, to.x, t),
    y: lerpNum(from.y, to.y, t),
    w: lerpNum(from.w, to.w, t),
    h: lerpNum(from.h, to.h, t),
  };
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The reader's own caption, SFX and speech bubbles for a step, over `lit` inside `rect`. The unlettered page draw
 * calls it itself; a guided (`lettered`) page whose art carries no lettering of its own — a one-off scenario intro
 * artboard — calls it once the pan has settled.
 */
export function drawComicLettering(scene: Phaser.Scene, rect: Rect, lit: Rect, step: ComicReaderStepView): void {
  drawStepContent(scene, rect, lit, step);
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
