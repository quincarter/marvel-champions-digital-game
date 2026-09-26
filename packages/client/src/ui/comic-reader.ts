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
import type { BubblePlacement, ComicBeat, PagePoint } from "../campaign/story.js";
import type { ComicReaderStepView } from "../view/comic-reader-model.js";
import {
  type CameraFrame,
  cinematicCameraPlan,
  containFit,
  cropForFrame,
  lerpFrame,
  needsSpotlightPan,
  panCropAt,
  panelFitsInPageCrop,
  planPan,
  type PanDim,
} from "../view/comic-pan.js";
import { campaignPagePicture, captionBox, speechBubble } from "./campaign-chrome.js";
import { setMask } from "./rex.js";
import { textStyle } from "./theme.js";

/** Below this, a text wrap throws in Phaser (`Text.setWordWrapWidth`) — the same floor `opener.ts` clamps to. */
const MIN_WRAP_WIDTH = 40;

/** Below this reading-area width (a phone), placed bubbles fall back to the stacked layout under the panel. */
const PLACED_MIN_WIDTH = 600;

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
 * The **within-beat** camera pan for a spotlight (unlettered) page whose current panel doesn't fit the page's own
 * cover-fit crop (`view/comic-pan.ts`): `t` is the caller's own auto-running progress (0 at the panel's own top/left,
 * 1 at its bottom/right — `opener.ts` drives this off a Phaser tween the moment a beat like this becomes current, so
 * every part of an overflowing panel is shown at some point without a player having to do anything). `reducedMotion`
 * skips the pan entirely and falls back to a static, whole-panel contain-fit (letterboxed) instead — motion off
 * means "never crop," not "the same crop, held still." Ignored when the panel already fits the page-level crop
 * (the ordinary case, e.g. GMW), and ignored for a lettered page (that pans panel-to-panel over `ComicReaderTween`,
 * a different pan already keyed to the player's own advance rather than the current beat's).
 */
export interface SpotlightPan {
  readonly t: number;
  readonly reducedMotion: boolean;
}

const NO_SPOTLIGHT_PAN: SpotlightPan = { t: 0, reducedMotion: false };

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
  spotPan?: SpotlightPan,
  cinematic?: CinematicOptions,
): ComicReaderDrawResult {
  // Every box's own reader (GMW, TRORS, MTS) draws through the cinematic camera now — full-bleed, no dimmed page,
  // no letterboxed strip at rest, whatever `ComicPage.lettered`/`cinematic` say (a lettered page still skips the
  // reader's own caption/lines/SFX inside `drawCinematicReaderStep`, since the art already carries them). `tween`/
  // `spotPan` are unused once `cinematic` is supplied; kept as parameters only for `drawComicReaderPicture`'s own
  // raw-`Picture` callers (a one-off scenario intro artboard, `campaign/scenario-intros.ts`), which never pass one.
  if (cinematic) {
    return drawCinematicReaderStep(scene, rect, campaignId, step, onReady, cinematic);
  }
  return drawComicReaderPicture(
    scene,
    rect,
    campaignPagePicture(campaignId, step.page.file),
    step,
    onReady,
    tween,
    spotPan,
  );
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
  spotPan?: SpotlightPan,
): ComicReaderDrawResult {
  scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
  if (rect.width <= 0 || rect.height <= 0) return { lit: null };

  const key = picture ? ensurePictureLoaded(scene, picture, onReady) : null;
  if (!key) return { lit: null };

  const source = scene.textures.get(key).getSourceImage() as { width: number; height: number };
  if (step.page.lettered) return drawGuidedStep(scene, rect, key, source, step, tween);
  return drawSpotlightStep(scene, rect, key, source, step, spotPan ?? NO_SPOTLIGHT_PAN);
}

/**
 * The spotlight (unlettered) draw: when the current panel fits inside the page's own cover-fit crop window
 * (`view/comic-pan.ts`'s `panelFitsInPageCrop` — the ordinary case, GMW today), the whole page is cover-fit and
 * recentered on the panel exactly as before (just clamped so the panel is never partly outside the window, rather
 * than blindly centered past it). When it doesn't (a dense MTS spread whose panel is proportioned nothing like the
 * reading area), the reader instead fills the frame with the *panel's* own cover-fit and pans the excess along
 * whichever axis overflows (`drawSpotlightPan`) — or, under reduced motion, holds the whole panel letterboxed
 * (`drawSpotlightContain`) rather than crop or animate.
 */
function drawSpotlightStep(
  scene: Phaser.Scene,
  rect: Rect,
  key: string,
  source: { width: number; height: number },
  step: ComicReaderStepView,
  spotPan: SpotlightPan,
): ComicReaderDrawResult {
  const fitsInPage = panelFitsInPageCrop(step.panel, { width: step.page.width, height: step.page.height }, rect);
  if (fitsInPage) return drawSpotlightPageContext(scene, rect, key, source, step);
  return spotPan.reducedMotion
    ? drawSpotlightContain(scene, rect, key, source, step)
    : drawSpotlightPan(scene, rect, key, source, step, spotPan.t);
}

/** GMW's own draw, unchanged: cover-fit the whole page, recenter on the current panel, spotlight and dim, then
 * the reader's own caption/lines/SFX. Only reached once `panelFitsInPageCrop` has already established the panel
 * lands acceptably in this crop (a full-bleed panel, or a sub-panel the page-level window is big enough for) — this
 * function itself is deliberately the exact pre-existing math, not reworked to also try to fully contain an
 * arbitrary sub-panel: an earlier version of this fix clamped the crop to guarantee that, and it traded one
 * GMW page's own already-fine crop (a few pixels of a panel's own edge, invisibly outside the frame) for a worse
 * one (Groot's own head, now cut) on `01-badoon`'s third panel — biasing crop position by geometry alone, with no
 * sense of where a panel's *content* actually sits, isn't reliably better than the plain center this always used.
 */
function drawSpotlightPageContext(
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
 * The full-bleed guided pan for a spotlight panel that doesn't fit the page's own crop (`view/comic-pan.ts`):
 * fills `rect` with the panel's own cover-fit and pans the overflowing axis to `t` — the caller's own auto-running
 * progress. No dimming or spotlight border (the panel already fills the whole reading area), same caption/lines/SFX
 * overlay as the page-context draw.
 */
function drawSpotlightPan(
  scene: Phaser.Scene,
  rect: Rect,
  key: string,
  source: { width: number; height: number },
  step: ComicReaderStepView,
  t: number,
): ComicReaderDrawResult {
  const panel = step.panel;
  const plan = planPan(panel, { width: rect.width, height: rect.height }, step.pan ?? undefined);
  const raw = panCropAt(panel, plan, t);
  const cropX = clamp(0, Math.max(0, source.width - 1), raw.cropX);
  const cropY = clamp(0, Math.max(0, source.height - 1), raw.cropY);
  const cropWidth = clamp(1, source.width - cropX, raw.cropWidth);
  const cropHeight = clamp(1, source.height - cropY, raw.cropHeight);
  const imageX = rect.x - cropX * plan.scale;
  const imageY = rect.y - cropY * plan.scale;
  scene.add
    .image(imageX, imageY, key)
    .setOrigin(0, 0)
    .setScale(plan.scale)
    .setCrop(cropX, cropY, cropWidth, cropHeight);

  const lit: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  drawStepContent(scene, rect, lit, step);
  return { lit };
}

/**
 * The reduced-motion fallback for a spotlight panel that doesn't fit the page's own crop: the whole panel, fit
 * (never cover-cropped) inside `rect` and letterboxed on whichever axis doesn't match — the same "never crop"
 * shape as the lettered guided view's own `drawGuidedStep`, just without its panel-to-panel tween.
 */
function drawSpotlightContain(
  scene: Phaser.Scene,
  rect: Rect,
  key: string,
  source: { width: number; height: number },
  step: ComicReaderStepView,
): ComicReaderDrawResult {
  const panel = step.panel;
  const { scale, drawWidth, drawHeight } = containFit(panel, rect);
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
  drawStepContent(scene, rect, lit, step);
  return { lit };
}

/**
 * A cinematic page's own draw (`ComicPage.cinematic`, MTS): reduced motion cuts straight to the whole-panel
 * contain-fit (`drawSpotlightContain`, reused as-is — "never crop" looks the same whether the page dims around it
 * or fills the frame). Otherwise `cinematic.driver` supplies the current camera frame (and, mid page-turn, the
 * outgoing page's own frame to crossfade from) and this draws one or two full-bleed cover-fit images with no
 * dimming, no spotlight border, and no square ever visible — `drawCinematicCrossfade`/`drawCinematicFrame` below.
 */
function drawCinematicReaderStep(
  scene: Phaser.Scene,
  rect: Rect,
  campaignId: string,
  step: ComicReaderStepView,
  onReady: () => void,
  cinematic: CinematicOptions,
): ComicReaderDrawResult {
  scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
  if (rect.width <= 0 || rect.height <= 0) return { lit: null };

  const currentPicture = campaignPagePicture(campaignId, step.page.file);
  const currentKey = currentPicture ? ensurePictureLoaded(scene, currentPicture, onReady) : null;
  if (!currentKey) return { lit: null };
  const currentSource = scene.textures.get(currentKey).getSourceImage() as PanDim;

  if (cinematic.reducedMotion) {
    cinematic.driver.reset();
    return drawSpotlightContain(scene, rect, currentKey, currentSource, step);
  }

  const state = cinematic.driver.advance(scene, campaignId, step, { width: rect.width, height: rect.height });
  if (state.from) {
    drawCinematicFrame(scene, rect, state.from.key, state.from.source, state.from.frame).setAlpha(1 - state.crossfadeT);
    drawCinematicFrame(scene, rect, currentKey, currentSource, state.frame).setAlpha(state.crossfadeT);
  } else {
    drawCinematicFrame(scene, rect, currentKey, currentSource, state.frame);
  }

  const lit: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  // A lettered page's own printed balloons/captions are the whole of what a beat shows — the reader draws none of
  // its own over it (`drawGuidedStep`'s same rule, before this replaced it as the universal reader draw).
  if (state.showContent && !step.page.lettered) drawStepContent(scene, rect, lit, step);
  return { lit };
}

/** One cover-fit image at `frame`'s own camera framing, cropped so it always fills `rect` with no letterbox. */
function drawCinematicFrame(
  scene: Phaser.Scene,
  rect: Rect,
  key: string,
  source: PanDim,
  frame: CameraFrame,
): Phaser.GameObjects.Image {
  const crop = cropForFrame(frame, rect, source);
  const imageX = rect.x - crop.cropX * frame.scale;
  const imageY = rect.y - crop.cropY * frame.scale;
  return scene.add
    .image(imageX, imageY, key)
    .setOrigin(0, 0)
    .setScale(frame.scale)
    .setCrop(crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight);
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

  // Wide enough to letter over the art (tablet, desktop): a line with its own spot sits there, tail on its speaker.
  // A phone keeps every line in the stacked layout below, where the art is too small to letter over.
  const placedHere = rect.width >= PLACED_MIN_WIDTH;
  const loose = placedHere ? step.lines.filter((line) => !line.placement) : step.lines;
  if (placedHere) {
    for (const line of step.lines) {
      if (line.placement) drawPlacedBubble(scene, rect, lit, bubbleTop, step.panel, line, line.placement);
    }
  }
  if (loose.length === 0) return;
  const belowRoom = rect.y + rect.height - (lit.y + lit.height) - 16;
  const rightRoom = rect.x + rect.width - (lit.x + lit.width) - 16;
  const bubbleWidth = Math.max(MIN_WRAP_WIDTH, Math.min(360, rightRoom > 160 ? rightRoom : rect.width - 24));

  if (rightRoom > 160) {
    // Room to the panel's right: bubbles stack there, beside the art rather than over it.
    let y = Math.max(bubbleTop, lit.y);
    for (const line of loose) {
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
    for (const line of loose) {
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
    for (const line of [...loose].reverse()) {
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

/**
 * One line's bubble at its own spot (`BubblePlacement`), mapped from page pixels through the panel's current
 * on-screen rect. It may run past the art into the reading area's gutter — a spot just outside the panel keeps the
 * scene clear — but stays inside the reading area and below any caption, with a tail from the bubble's edge to the
 * speaker. A narrator line (a hero's fallback) keeps the spot but has no one to point at.
 */
function drawPlacedBubble(
  scene: Phaser.Scene,
  area: Rect,
  lit: Rect,
  minTop: number,
  panel: ComicBeat["panel"],
  line: ComicReaderStepView["lines"][number],
  placement: BubblePlacement,
): void {
  const scale = lit.width / Math.max(1, panel.w);
  const toScreen = (point: PagePoint): { x: number; y: number } => ({
    x: lit.x + (point.x - panel.x) * scale,
    y: lit.y + (point.y - panel.y) * scale,
  });
  const speaker = line.speaker.kind === "hero" || line.speaker.kind === "npc" ? line.speaker.name : undefined;
  const width = Math.max(MIN_WRAP_WIDTH, Math.min(260, lit.width * 0.3));
  const options = { ...(speaker ? { speaker } : {}), tail: "none" as const, size: 15 };
  // Measured off-screen first: the bubble is centred on its spot, so its height has to be known before it is placed.
  const probe = speechBubble(scene, -10000, -10000, width, line.text, options);
  const { width: w, height: h } = probe.rect;
  for (const object of probe.objects) object.destroy();

  const centre = toScreen(placement.bubble);
  const margin = 10;
  const x = clamp(area.x + margin, Math.max(area.x + margin, area.x + area.width - margin - w), centre.x - w / 2);
  const y = clamp(
    Math.max(area.y + margin, minTop),
    Math.max(area.y + margin, minTop, area.y + area.height - margin - h),
    centre.y - h / 2,
  );
  const pointAt = line.speaker.kind === "narrator" ? undefined : toScreen(placement.speaker);
  speechBubble(scene, x, y, width, line.text, { ...options, ...(pointAt ? { pointAt } : {}) });
}

/** How long a spotlight panel's own within-beat pan (`SpotlightAutoPan`) takes to cross the whole overflow. */
const SPOTLIGHT_PAN_DURATION_MS = 3200;

/**
 * Drives a spotlight panel's own within-beat pan (`SpotlightPan`) as a Phaser tween: call `progressFor` every
 * redraw with the step about to be drawn — starts (or restarts) the pan the moment the current beat's own panel
 * changes, runs once to completion and then holds at `t = 1` until the next beat changes it again. Reduced motion
 * never starts a tween at all (`t` stays 0 and `drawSpotlightStep` falls back to a static contain-fit instead of
 * animating a crop — motion off means "never crop," not "the same crop, held still").
 *
 * One instance per scene (`opener.ts`, `aftermath.ts`, `scenario-intro.ts` each own one, the same shape as their
 * existing `#panTween` field for the lettered guided view's own panel-to-panel pan): call `destroy` on shutdown to
 * stop its own tween without touching the scene's others.
 */
export class SpotlightAutoPan {
  readonly #scene: Phaser.Scene;
  readonly #onTick: () => void;
  #key: string | null = null;
  #tween: Phaser.Tweens.Tween | null = null;
  #t = 0;

  constructor(scene: Phaser.Scene, onTick: () => void) {
    this.#scene = scene;
    this.#onTick = onTick;
  }

  progressFor(step: ComicReaderStepView, target: PanDim, reducedMotion: boolean): SpotlightPan {
    const key = `${step.page.file}:${step.panel.x},${step.panel.y},${step.panel.w},${step.panel.h}`;
    if (key !== this.#key) {
      this.#key = key;
      this.#tween?.stop();
      this.#tween = null;
      this.#t = 0;
      // Nothing to animate for a beat the page-context draw handles, or a panel-fill cover-fit with no overflow on
      // either axis — starting a tween anyway would just redraw the whole scene every frame for no visual change,
      // and cost a player a dropped "NEXT ▸" tap for it (`needsSpotlightPan`'s own doc comment).
      const page = { width: step.page.width, height: step.page.height };
      if (!reducedMotion && needsSpotlightPan(step.panel, page, target, step.pan ?? undefined)) {
        const state = { t: 0 };
        this.#tween = this.#scene.tweens.add({
          targets: state,
          t: 1,
          duration: SPOTLIGHT_PAN_DURATION_MS,
          ease: "Sine.easeInOut",
          onUpdate: () => {
            this.#t = state.t;
            this.#onTick();
          },
          onComplete: () => {
            this.#tween = null;
          },
        });
      }
    }
    return { t: this.#t, reducedMotion };
  }

  /** Stops the in-flight tween, if any — the scene's own SHUTDOWN handler, matching `#panTween?.stop()`. */
  destroy(): void {
    this.#tween?.stop();
    this.#tween = null;
  }
}

/** How long a cinematic page's own camera takes to settle from one panel's framing to the next (same page). */
const CINEMATIC_SETTLE_MS = 700;
/** How long a cinematic page turn's own crossfade takes. */
const CINEMATIC_CROSSFADE_MS = 450;
/** How long a cinematic beat's own slow within-beat reveal pan takes, once settled — same pace as the spotlight
 * reader's own `SPOTLIGHT_PAN_DURATION_MS` (both are "read the rest of an overflowing panel at a comfortable pace"). */
const CINEMATIC_REVEAL_MS = SPOTLIGHT_PAN_DURATION_MS;

export interface CinematicOptions {
  readonly driver: CinematicDriver;
  readonly reducedMotion: boolean;
}

interface CinematicPageFrame {
  readonly key: string;
  readonly source: PanDim;
  readonly frame: CameraFrame;
}

interface CinematicState {
  readonly frame: CameraFrame;
  /** Set only mid page-turn: the outgoing page's own last framing, crossfading out as `key`'s own page fades in. */
  readonly from: CinematicPageFrame | null;
  /** 0 at `from`, 1 at `key` — meaningless (and `from` always null) once a crossfade finishes. */
  readonly crossfadeT: number;
  /** False while a camera move (settle or crossfade) is in flight — a beat's own caption/lines/SFX wait for the
   * camera to arrive rather than lettering over a page that's still sliding past. */
  readonly showContent: boolean;
}

/**
 * Drives a cinematic page's own continuous camera (`ComicPage.cinematic`, MTS): the panel-to-panel *settle* (a
 * smooth pan+zoom from the previous panel's own last framing to the new one's start, `CINEMATIC_SETTLE_MS`), the
 * page-turn *crossfade* (a short alpha blend between the outgoing and incoming page, `CINEMATIC_CROSSFADE_MS` —
 * there's no pixel-continuous camera move *across* two different images, so this is the "clean transition" instead
 * of a cut), and, once settled, a beat whose panel overflows the frame after fitting keeps panning slowly on its
 * own (`CINEMATIC_REVEAL_MS`, the same shape as `SpotlightAutoPan`'s reveal but continuing from the settle's own
 * end point rather than always starting over at the panel's own top/left).
 *
 * `advance` is called every redraw with the step about to be drawn; a beat change (the step's own key differs from
 * the last one seen) starts the appropriate transition, a still-current beat just returns where the camera already
 * is. `skipAhead` is `opener.ts`'s own "NEXT ▸ never blocks" door: a tap that lands while `isSettling()` jumps the
 * in-flight settle/crossfade straight to its own end instead of queuing a second one — the caller still has to tap
 * again to actually advance the beat, the same "one tap always does exactly one thing" a moving target wouldn't.
 * `reset` drops every tween without settling anywhere (reduced motion's own use, and this is a one-per-scene
 * instance — the same shape as `SpotlightAutoPan`, `destroy` on shutdown to stop its own tweens).
 */
export class CinematicDriver {
  readonly #onTick: () => void;
  #scene: Phaser.Scene | null = null;
  #key: string | null = null;
  #pageFile: string | null = null;
  #frame: CameraFrame | null = null;
  #from: CinematicPageFrame | null = null;
  #crossfadeT = 1;
  #showContent = true;
  #settleTween: Phaser.Tweens.Tween | null = null;
  #crossfadeTween: Phaser.Tweens.Tween | null = null;
  #revealTween: Phaser.Tweens.Tween | null = null;
  /** The reveal this beat starts once its own settle/crossfade finishes — null for a beat with no overflow left
   * once the zoom cap (`cinematicCameraPlan`'s own `CINEMATIC_MAX_ZOOM_RATIO`) is applied. */
  #pendingReveal: { readonly endFrame: CameraFrame } | null = null;

  constructor(onTick: () => void) {
    this.#onTick = onTick;
  }

  /** True while a settle or crossfade is in flight — the ongoing slow reveal pan doesn't count (it never blocks
   * "NEXT ▸", only a beat-to-beat camera move does). */
  isSettling(): boolean {
    return this.#settleTween !== null || this.#crossfadeTween !== null;
  }

  /** Jumps any in-flight settle/crossfade straight to its own end and starts the arriving beat's reveal, if it has
   * one — a no-op once `isSettling()` is already false. */
  skipAhead(): void {
    this.#settleTween?.stop();
    this.#settleTween = null;
    this.#crossfadeTween?.stop();
    this.#crossfadeTween = null;
    if (!this.#pendingReveal) return;
    // Land exactly where the settle/crossfade was headed, then let `#startReveal` take it from there.
    this.#from = null;
    this.#crossfadeT = 1;
    this.#showContent = true;
    this.#startReveal();
  }

  advance(scene: Phaser.Scene, campaignId: string, step: ComicReaderStepView, target: PanDim): CinematicState {
    this.#scene = scene;
    const key = `${step.page.file}:${step.panel.x},${step.panel.y},${step.panel.w},${step.panel.h}`;
    if (key === this.#key && this.#pageFile === step.page.file && this.#frame) {
      return this.#snapshot();
    }
    const plan = cinematicCameraPlan(
      step.panel,
      { width: step.page.width, height: step.page.height },
      target,
      step.pan ?? undefined,
    );
    const startFrame = plan.start;
    const pageChanged = this.#pageFile !== null && this.#pageFile !== step.page.file;
    this.#key = key;
    this.#settleTween?.stop();
    this.#settleTween = null;
    this.#crossfadeTween?.stop();
    this.#crossfadeTween = null;
    this.#revealTween?.stop();
    this.#revealTween = null;
    this.#pendingReveal = plan.axis === "none" ? null : { endFrame: plan.end };

    if (this.#pageFile === null) {
      // The very first beat this driver has ever drawn: nothing to move *from*, so it settles at rest immediately —
      // matching the spotlight reader's own first-beat behavior before this existed.
      this.#pageFile = step.page.file;
      this.#frame = startFrame;
      this.#showContent = true;
      this.#startReveal();
      return this.#snapshot();
    }

    if (pageChanged) {
      const fromPicture = campaignPagePicture(campaignId, this.#pageFile);
      const fromKey = fromPicture
        ? ensurePictureLoaded(scene, fromPicture, () => {
            this.#onTick();
          })
        : null;
      const fromFrame = this.#frame;
      this.#pageFile = step.page.file;
      this.#showContent = false;
      if (fromKey && fromFrame) {
        const fromSource = scene.textures.get(fromKey).getSourceImage() as PanDim;
        this.#from = { key: fromKey, source: fromSource, frame: fromFrame };
        this.#crossfadeT = 0;
        this.#frame = startFrame;
        const state = { t: 0 };
        this.#crossfadeTween = scene.tweens.add({
          targets: state,
          t: 1,
          duration: CINEMATIC_CROSSFADE_MS,
          ease: "Sine.easeInOut",
          onUpdate: () => {
            this.#crossfadeT = state.t;
            this.#onTick();
          },
          onComplete: () => {
            this.#crossfadeTween = null;
            this.#from = null;
            this.#showContent = true;
            this.#startReveal();
            this.#onTick();
          },
        });
      } else {
        // The outgoing page's own art isn't loaded (shouldn't happen — it was just on screen — but a texture can
        // still be evicted): cut straight to the new page rather than crossfade from nothing.
        this.#frame = startFrame;
        this.#from = null;
        this.#crossfadeT = 1;
        this.#showContent = true;
        this.#startReveal();
      }
      return this.#snapshot();
    }

    // Same page, a different panel: pan+zoom the camera from wherever it last was to the new panel's own start.
    const fromFrame = this.#frame ?? startFrame;
    this.#showContent = false;
    const state = { t: 0 };
    this.#settleTween = scene.tweens.add({
      targets: state,
      t: 1,
      duration: CINEMATIC_SETTLE_MS,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        this.#frame = lerpFrame(fromFrame, startFrame, state.t);
        this.#onTick();
      },
      onComplete: () => {
        this.#settleTween = null;
        this.#frame = startFrame;
        this.#showContent = true;
        this.#startReveal();
        this.#onTick();
      },
    });
    return this.#snapshot();
  }

  #startReveal(): void {
    const pending = this.#pendingReveal;
    if (!pending || !this.#scene) return;
    const endFrame = pending.endFrame;
    const startFrame = this.#frame ?? endFrame;
    const state = { t: 0 };
    this.#revealTween = this.#scene.tweens.add({
      targets: state,
      t: 1,
      duration: CINEMATIC_REVEAL_MS,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        this.#frame = lerpFrame(startFrame, endFrame, state.t);
        this.#onTick();
      },
      onComplete: () => {
        this.#revealTween = null;
      },
    });
  }

  #snapshot(): CinematicState {
    return {
      frame: this.#frame!,
      from: this.#from,
      crossfadeT: this.#crossfadeT,
      showContent: this.#showContent,
    };
  }

  /** Stops every in-flight tween, if any, and forgets the last-settled frame — reduced motion's own use (`advance`
   * is never called for a reduced-motion step, so this is the only way a later un-reduced-motion beat starts a
   * clean settle rather than lerping from a frame drawn under a different geometry), and the scene's own SHUTDOWN. */
  reset(): void {
    this.#settleTween?.stop();
    this.#settleTween = null;
    this.#crossfadeTween?.stop();
    this.#crossfadeTween = null;
    this.#revealTween?.stop();
    this.#revealTween = null;
    this.#pageFile = null;
    this.#key = null;
    this.#frame = null;
    this.#from = null;
    this.#pendingReveal = null;
  }

  /** Stops every in-flight tween — the scene's own SHUTDOWN handler. */
  destroy(): void {
    this.#settleTween?.stop();
    this.#crossfadeTween?.stop();
    this.#revealTween?.stop();
  }
}
