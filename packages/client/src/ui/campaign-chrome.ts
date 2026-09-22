/**
 * The comic-book pieces every campaign screen shares (`Marvel Champions game screens/Campaign - *.dc.html`): the
 * ink top bar with its boxed back button, the ink action bar at the thumb, yellow caption boxes, white speech
 * bubbles, outcome stamps, issue pips, "Panel art: …" placeholders and cover-fitted villain/hero pictures.
 *
 * Built on the same tokens and `Mc*` widgets as every other screen — nothing here draws a colour the design system
 * doesn't name. Every helper returns the objects it drew (or the widget), so a scene that redraws on resize can
 * destroy them with the rest of its display list (`destroyChildren`).
 */
import Phaser from "phaser";
import { HERO_ART, heroArtFor } from "../art/hero-art.js";
import { coverFit, ensurePictureLoaded, type Picture } from "../art/pictures.js";
import { ART_CATALOG } from "../art/scenario-art.js";
import { accent, border, hit, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { formFactorFor, type FormFactor, type Rect } from "../view/layout.js";
import { cssOf, fontFamilyOf, textStyle } from "./theme.js";
import { McButton, fitText } from "./widgets.js";

/** Heights the canvases draw at: 60px chrome on desktop/tablet ("60px chrome to match Screens - Desktop"), 52 on phone. */
export const CAMPAIGN_TOP_BAR = { wide: 60, phone: 52 } as const;
/** The ink action bar at the bottom: one 62px CTA with its padding. */
export const CAMPAIGN_ACTION_BAR = { wide: 88, phone: 80 } as const;

export const isPhoneWidth = (formFactor: FormFactor): boolean =>
  formFactor === "phone" || formFactor === "phoneLandscape";

/** The screen's form factor and the two bar heights it gets. */
export function campaignFrame(scene: Phaser.Scene): {
  readonly width: number;
  readonly height: number;
  readonly formFactor: FormFactor;
  readonly phone: boolean;
  readonly topBar: number;
  readonly actionBar: number;
  /** The design's outer gutter: 24px wide, 16 on phone. */
  readonly gutter: number;
} {
  const { width, height } = scene.scale.gameSize;
  const formFactor = formFactorFor(width, height);
  const phone = isPhoneWidth(formFactor);
  return {
    width,
    height,
    formFactor,
    phone,
    topBar: phone ? CAMPAIGN_TOP_BAR.phone : CAMPAIGN_TOP_BAR.wide,
    actionBar: phone ? CAMPAIGN_ACTION_BAR.phone : CAMPAIGN_ACTION_BAR.wide,
    gutter: phone ? 16 : 24,
  };
}

/** Bangers at an arbitrary size — the canvases letter titles well past `typeRole.screenTitle`. */
export const bangers = (size: number, lineHeight = 0.9): TypeSpec => ({
  ...typeRole.barTitle,
  size,
  lineHeight,
});

export interface TopBarOptions {
  /** "◂ TITLE", "◂ COVER" — drawn as a boxed paper-on-ink button. Omit for no back button (the opener). */
  readonly backLabel?: string;
  readonly onBack?: () => void;
  readonly title: string;
  /** The small uppercase label at the right edge ("ISSUE 3 OF 5", "AFTER ISSUE #2"). */
  readonly right?: string;
  /** A red chip before the title ("ROUND 4" on the in-game beat). */
  readonly chip?: string;
}

export interface TopBar {
  readonly height: number;
  readonly back: McButton | null;
  readonly backRect: Rect | null;
}

/** The ink top bar: boxed back button, Bangers title, right-aligned label. */
export function drawTopBar(scene: Phaser.Scene, options: TopBarOptions): TopBar {
  const frame = campaignFrame(scene);
  const height = frame.topBar;
  scene.add.rectangle(0, 0, frame.width, height, surface.ink.hex).setOrigin(0, 0);
  const pad = frame.phone ? 12 : 22;
  let x = pad;
  let back: McButton | null = null;
  let backRect: Rect | null = null;
  if (options.backLabel && options.onBack) {
    const labelWidth = Math.max(frame.phone ? 36 : 64, estimateBangersWidth(options.backLabel, 22) + 26);
    backRect = {
      x,
      y: (height - 38) / 2,
      width: frame.phone && options.backLabel.length <= 2 ? 36 : labelWidth,
      height: 38,
    };
    back = new McButton(scene, {
      kind: "onInk",
      label: options.backLabel,
      type: typeRole.backLabel,
      rect: backRect,
      onClick: options.onBack,
    });
    x += backRect.width + 14;
  }
  if (options.chip) {
    const chip = scene.add
      .text(0, height / 2, options.chip.toUpperCase(), textStyle(bangers(frame.phone ? 17 : 20), surface.paper.hex))
      .setOrigin(0, 0.5);
    const chipWidth = chip.width + 18;
    scene.add.rectangle(x, height / 2, chipWidth, 26, accent.heroRed.hex).setOrigin(0, 0.5);
    chip.setX(x + 9).setDepth(1);
    x += chipWidth + 14;
  }
  let rightWidth = 0;
  if (options.right) {
    const right = scene.add
      .text(
        frame.width - pad,
        height / 2,
        options.right.toUpperCase(),
        textStyle(typeRole.label, surface.paper.hex, ink.meta),
      )
      .setOrigin(1, 0.5)
      .setLetterSpacing(1.1);
    rightWidth = right.width + 16;
  }
  const title = scene.add
    .text(x, height / 2, options.title.toUpperCase(), textStyle(bangers(frame.phone ? 22 : 28), surface.paper.hex))
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);
  fitText(title, frame.width - pad - rightWidth - x, frame.phone ? 22 : 28);
  return { height, back, backRect };
}

/** The ink action bar across the bottom; returns its rect so the caller places the CTA inside it. */
export function drawActionBar(scene: Phaser.Scene): Rect {
  const frame = campaignFrame(scene);
  const rect: Rect = { x: 0, y: frame.height - frame.actionBar, width: frame.width, height: frame.actionBar };
  scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
  return rect;
}

/** The primary CTA's rect in an action bar: right-aligned 425px wide, full width on phone (C02, C07, C08). */
export function actionBarCta(bar: Rect, phone: boolean, width = 425): Rect {
  const pad = phone ? 12 : 16;
  const height = Math.max(hit.primary, 62);
  const w = phone ? bar.width - pad * 2 : Math.min(width, bar.width - pad * 2);
  return { x: bar.x + bar.width - pad - w, y: bar.y + (bar.height - height) / 2, width: w, height };
}

/**
 * The yellow caption box: ink border, uppercase italic Public Sans 800 — the narrator's voice
 * ("THE ADIRONDACKS. 4 A.M. …"). Returns the objects and the box's rect.
 */
export function captionBox(
  scene: Phaser.Scene,
  x: number,
  y: number,
  maxWidth: number,
  text: string,
  options: { readonly size?: number; readonly ground?: number } = {},
): { readonly objects: readonly Phaser.GameObjects.GameObject[]; readonly rect: Rect } {
  const size = options.size ?? 12;
  const pad = 12;
  const label = scene.add
    .text(x + pad, y + pad * 0.75, text.toUpperCase(), {
      fontFamily: fontFamilyOf(typeRole.label),
      fontSize: `${size}px`,
      fontStyle: "italic 800",
      color: cssOf(surface.ink.hex),
      wordWrap: { width: maxWidth - pad * 2, useAdvancedWrap: true },
      lineSpacing: 2,
    })
    .setOrigin(0, 0);
  const rect: Rect = { x, y, width: Math.min(maxWidth, label.width + pad * 2), height: label.height + pad * 1.5 };
  const box = scene.add.graphics();
  box.fillStyle(options.ground ?? signal.caution.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  box.lineStyle(border.object, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
  scene.children.bringToTop(label);
  return { objects: [box, label], rect };
}

export interface BubbleOptions {
  /** The small red uppercase line above the text ("S.H.I.E.L.D. QUARTERMASTER"). */
  readonly speaker?: string;
  /** Where the tail points from: "left" (a portrait beside it), "bottom", or none. */
  readonly tail?: "left" | "bottom" | "none";
  readonly size?: number;
  /** The design's offset "print shadow" under a bubble: ink by default, Hero Red on the aftermath narrator. */
  readonly shadow?: number;
}

/** A white speech bubble with a 3px ink border and an offset shadow (C04, C05, C07, C09, C11). */
export function speechBubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  maxWidth: number,
  text: string,
  options: BubbleOptions = {},
): { readonly objects: readonly Phaser.GameObjects.GameObject[]; readonly rect: Rect } {
  const size = options.size ?? 14;
  const padX = 16;
  const padY = 12;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const graphics = scene.add.graphics();
  objects.push(graphics);
  let top = y + padY;
  let speaker: Phaser.GameObjects.Text | null = null;
  if (options.speaker) {
    speaker = scene.add
      .text(x + padX, top, options.speaker.toUpperCase(), textStyle(typeRole.label, accent.heroRed.hex))
      .setLetterSpacing(1.2);
    objects.push(speaker);
    top += speaker.height + 4;
  }
  const body = scene.add.text(x + padX, top, text, {
    fontFamily: fontFamilyOf(typeRole.emphasis),
    fontSize: `${size}px`,
    fontStyle: "700",
    color: cssOf(surface.ink.hex),
    wordWrap: { width: maxWidth - padX * 2, useAdvancedWrap: true },
    lineSpacing: 3,
  });
  objects.push(body);
  const contentWidth = Math.max(body.width, speaker?.width ?? 0);
  const rect: Rect = {
    x,
    y,
    width: Math.min(maxWidth, contentWidth + padX * 2),
    height: top - y + body.height + padY,
  };
  const radius = Math.min(16, rect.height / 2);
  graphics
    .fillStyle(options.shadow ?? surface.ink.hex, 1)
    .fillRoundedRect(rect.x + 5, rect.y + 5, rect.width, rect.height, radius);
  graphics.fillStyle(surface.card.hex, 1).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, radius);
  graphics
    .lineStyle(border.object, surface.ink.hex, 1)
    .strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, radius);
  if (options.tail === "left") {
    const ty = rect.y + Math.min(rect.height / 2, 22);
    graphics.fillStyle(surface.card.hex, 1).fillTriangle(rect.x + 2, ty - 8, rect.x + 2, ty + 8, rect.x - 12, ty);
    graphics.lineStyle(border.object, surface.ink.hex, 1).lineBetween(rect.x, ty - 8, rect.x - 12, ty);
    graphics.lineBetween(rect.x - 12, ty, rect.x, ty + 8);
  } else if (options.tail === "bottom") {
    const tx = rect.x + Math.min(rect.width * 0.3, 60);
    const by = rect.y + rect.height;
    graphics.fillStyle(surface.card.hex, 1).fillTriangle(tx - 8, by - 2, tx + 8, by - 2, tx - 2, by + 12);
    graphics.lineStyle(border.object, surface.ink.hex, 1).lineBetween(tx - 8, by, tx - 2, by + 12);
    graphics.lineBetween(tx - 2, by + 12, tx + 8, by);
  }
  return { objects, rect };
}

/** A boxed Bangers stamp ("ISSUE #1 · WON", "WON", "VOL. 1"): solid ground, paper border on ink. */
export function stamp(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: {
    readonly ground?: number;
    readonly color?: number;
    readonly size?: number;
    readonly outline?: number;
  } = {},
): { readonly objects: readonly Phaser.GameObjects.GameObject[]; readonly rect: Rect } {
  const size = options.size ?? 22;
  const label = scene.add.text(0, 0, text.toUpperCase(), textStyle(bangers(size), options.color ?? surface.paper.hex));
  const rect: Rect = { x, y, width: label.width + 20, height: label.height + 10 };
  const box = scene.add.graphics();
  box.fillStyle(options.ground ?? signal.heal.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  box
    .lineStyle(border.object, options.outline ?? surface.paper.hex, 1)
    .strokeRect(rect.x, rect.y, rect.width, rect.height);
  label.setPosition(x + 10, y + 5);
  scene.children.bringToTop(label);
  return { objects: [box, label], rect };
}

export type PipState = "done" | "current" | "empty";

/** The five issue pips under a campaign's name (C00b, C01): paper done, red current (paper ring), outlined empty. */
export function issuePips(
  scene: Phaser.Scene,
  rect: Rect,
  pips: readonly PipState[],
  onInk = true,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const gap = 5;
  const count = Math.max(1, pips.length);
  const width = (rect.width - gap * (count - 1)) / count;
  const fg = onInk ? surface.paper.hex : surface.ink.hex;
  pips.forEach((state, index) => {
    const x = rect.x + index * (width + gap);
    if (state === "done") g.fillStyle(fg, 1).fillRect(x, rect.y, width, rect.height);
    else if (state === "current") {
      g.fillStyle(fg, 1).fillRect(x - 2, rect.y - 2, width + 4, rect.height + 4);
      g.fillStyle(accent.heroRed.hex, 1).fillRect(x, rect.y, width, rect.height);
    } else g.lineStyle(2, fg, 0.35).strokeRect(x + 1, rect.y + 1, width - 2, rect.height - 2);
  });
  return g;
}

/** The design's "Panel art: …" placeholder: a small picture glyph over a centered note. */
export function artNote(scene: Phaser.Scene, rect: Rect, note: string, onInk = false): Phaser.GameObjects.GameObject[] {
  const color = onInk ? surface.paper.hex : surface.ink.hex;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const g = scene.add.graphics();
  g.lineStyle(2, color, 0.55).strokeRoundedRect(cx - 12, cy - 30, 24, 22, 3);
  g.fillStyle(color, 0.55).fillCircle(cx - 5, cy - 23, 2.5);
  g.lineBetween(cx - 10, cy - 11, cx - 2, cy - 18);
  g.lineBetween(cx - 2, cy - 18, cx + 10, cy - 11);
  const text = scene.add
    .text(cx, cy + 4, note, { ...textStyle(typeRole.body, color, ink.secondary), fontSize: "13px", align: "center" })
    .setOrigin(0.5, 0)
    .setWordWrapWidth(Math.max(80, rect.width - 24));
  return [g, text];
}

/** A villain's picture for a campaign node's scenario (`art/scenarios/<id>/villain.*`), or null. */
export function villainPicture(scenarioId: string): Picture | null {
  return ART_CATALOG.scenarios.get(scenarioId)?.villain[0] ?? null;
}

/** A hero's picture by identity card id (`art/heroes/<id>-*`), always the first variant so redraws don't flicker. */
export function heroPicture(identityId: string): Picture | null {
  return heroArtFor(HERO_ART, identityId, () => 0);
}

/**
 * Draws `picture` cover-fitted into `rect` (cropped, never stretched). `focusY` is the vertical focal point, 0 top
 * to 1 bottom — portraits want faces (0.15), not belts. Returns null while the picture loads; `onReady` fires once it
 * has, and the caller redraws.
 */
export function drawPicture(
  scene: Phaser.Scene,
  picture: Picture | null,
  rect: Rect,
  onReady: () => void,
  options: { readonly focusY?: number; readonly grayscale?: boolean; readonly alpha?: number } = {},
): Phaser.GameObjects.Image | null {
  if (!picture || rect.width <= 0 || rect.height <= 0) return null;
  const key = ensurePictureLoaded(scene, picture, onReady);
  if (!key) return null;
  const source = scene.textures.get(key).getSourceImage() as { width: number; height: number };
  const fit = coverFit(source, rect);
  const focusY = options.focusY ?? 0.5;
  const cropY = Math.max(0, Math.min(source.height - fit.cropHeight, (source.height - fit.cropHeight) * focusY));
  const image = scene.add
    .image(rect.x - fit.cropX * fit.scale, rect.y - cropY * fit.scale, key)
    .setOrigin(0, 0)
    .setScale(fit.scale)
    .setCrop(fit.cropX, cropY, fit.cropWidth, fit.cropHeight)
    .setAlpha(options.alpha ?? 1);
  if (options.grayscale) desaturate(image);
  return image;
}

/** Finished issues read as back issues: greyscale (C07). Uses Phaser 4's colour-matrix filter when available. */
export function desaturate(image: Phaser.GameObjects.Image): void {
  const filterable = image as unknown as {
    enableFilters?: () => {
      filters?: { internal?: { addColorMatrix?: () => { colorMatrix?: { grayscale?: (v: number) => void } } } };
    };
  };
  const filters = filterable.enableFilters?.()?.filters;
  const matrix = filters?.internal?.addColorMatrix?.();
  if (matrix?.colorMatrix?.grayscale) matrix.colorMatrix.grayscale(1);
  else image.setTint(0xb8b8b8);
}

/** A rough Bangers width before the text exists — for sizing the back button box. */
function estimateBangersWidth(text: string, size: number): number {
  return text.length * size * 0.42;
}

/** A "section heading ────" in the campaign's Bangers-and-rule style (C07b "ATTEMPTS ───", C08 "HANDLED FOR YOU ───"). */
export function ruleHeading(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  text: string,
  color: number = surface.ink.hex,
  size = 20,
): number {
  const heading = scene.add.text(x, y, text.toUpperCase(), textStyle(bangers(size), color));
  const ruleX = x + heading.width + 12;
  if (ruleX < x + width) {
    scene.add.rectangle(ruleX, y + heading.height / 2, x + width - ruleX, 3, color).setOrigin(0, 0.5);
  }
  return y + heading.height + 12;
}
