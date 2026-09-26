/**
 * A roster "entity card" face (`scenes/roster-panel.ts`'s `renderShelfCard`: the art window, the footer's title
 * and label line, the aspect stamps, the border and the corner tag) painted onto one 2D canvas, so the card reaches
 * Phaser as one texture instead of a dozen game objects.
 *
 * It exists for the pack-shelf rosters' scroll performance. Drawn as game objects, a card is three to five Phaser
 * `Text` labels, each with its own canvas, its own `fitText` search and its own texture upload, plus five
 * `Graphics`, plus the full-size art image the Phaser loader decoded on the main thread (some hero art is
 * 2160×3840, 33 MB decoded, to show at a few hundred pixels). This module paints the same card from plain data, so
 * it runs in a worker (`card-face.worker.ts`, over an `OffscreenCanvas`) as happily as on the main thread (the
 * fallback where a worker can't), and the art it draws from is decoded and downscaled off the main thread too.
 *
 * Nothing here imports Phaser. The text layout mirrors Phaser's own `Text` (`updateText`, `GetTextSize`,
 * `MeasureText`) and this app's `fitText` step for step, so a baked card measures, shrinks and truncates exactly as
 * the game-object version did: same font string (including the desktop size bump, `view/desktop-type.ts`), same
 * per-letter spacing, same ascent-based baseline, same binary searches.
 */
import { desktopFont } from "../view/desktop-type.js";

/** One font as Phaser's `TextStyle` would build it (`ui/theme.ts`'s `textStyle`). */
export interface FaceFont {
  /** The CSS `font-family` value (`fontFamilyOf`). */
  readonly family: string;
  readonly size: number;
  readonly weight: number;
  readonly letterSpacing: number;
  /** Extra room on the right, as `textStyle` gives Bangers (its slant draws past its advance width). */
  readonly padRight: number;
  readonly uppercase: boolean;
}

export interface FaceStamp {
  readonly label: string;
  readonly fill: string;
  readonly ink: string;
}

/** Everything a card face depends on, as plain, structured-cloneable data. Two equal specs paint equal pixels. */
export interface CardFaceSpec {
  readonly width: number;
  readonly height: number;
  /** Device pixels per game pixel (`Settings.textResolution`). */
  readonly resolution: number;
  /** Whether small type draws a size up (`isDesktopType()` on the calling scene). */
  readonly desktop: boolean;
  /** An absolute URL to fetch the art from, or null for the plain parchment window. */
  readonly artUrl: string | null;
  readonly artFit: "cover" | "contain";
  /** Where a cover crop sits vertically, 0 top to 1 bottom (`drawArt`'s `focusY`). */
  readonly artFocusY: number;
  readonly dim: number;
  readonly title: string;
  readonly titleFont: FaceFont;
  readonly subtitle: string;
  readonly subtitleFont: FaceFont;
  /** The size `fitText` starts the subtitle's search from (`typeRole.rowTitle.size`, its default). */
  readonly subtitleFitStart: number;
  readonly subtitleColor: string;
  readonly subtitleAlpha: number;
  readonly stamps: readonly FaceStamp[];
  readonly stampFont: FaceFont;
  readonly tag: string | null;
  readonly tagFont: FaceFont;
  readonly selected: boolean;
  /** Whether the unselected border draws at the dimmed ink (`blockedBy`). */
  readonly blocked: boolean;
  /** `fitText`'s floor (`CAPTION_FLOOR`). */
  readonly captionFloor: number;
  readonly colors: {
    readonly card: string;
    readonly parchment: string;
    readonly ink: string;
    readonly heroRed: string;
    readonly paper: string;
  };
  readonly inkLabel: number;
}

/** A stable cache key for a spec: equal specs, equal keys. */
export function cardFaceKey(spec: CardFaceSpec): string {
  return JSON.stringify(spec);
}

/** The part of `CanvasRenderingContext2D` / `OffscreenCanvasRenderingContext2D` this paints with. */
export interface FaceContext {
  font: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  textBaseline: CanvasTextBaseline;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  measureText(text: string): {
    readonly width: number;
    readonly actualBoundingBoxAscent?: number;
    readonly actualBoundingBoxDescent?: number;
  };
  fillText(text: string, x: number, y: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
}

/**
 * Phaser's `TextStyle.testString`, what `MeasureText` takes a font's ascent and descent from — byte for byte, and
 * those bytes are "|MÉqgy" mis-decoded (`Ã‰`, U+00C3 U+2030) in Phaser's own source. The tilde rides higher than the
 * acute, so "fixing" it here would set every baked label a few pixels lower than the same label as a `Text`.
 */
const TEST_STRING = "|M\u00C3\u2030qgy";

/** Phaser's `TextStyle._font` for `font` at `size`, through the desktop bump. */
export function fontString(font: FaceFont, size: number, desktop: boolean): string {
  const style = font.weight === 400 ? "normal" : `${font.weight}`;
  return desktopFont(`${style} ${size}px ${font.family}`, desktop);
}

/** A laid-out single-line label: what Phaser's `Text` would report for `width`/`height`, and where it draws. */
export interface TextBox {
  readonly text: string;
  readonly font: string;
  readonly letterSpacing: number;
  readonly width: number;
  readonly height: number;
  /** The baseline, from the box's top (Phaser rounds it: `autoRound`). */
  readonly baseline: number;
}

export function measureBox(ctx: FaceContext, text: string, font: FaceFont, size: number, desktop: boolean): TextBox {
  const css = fontString(font, size, desktop);
  ctx.font = css;
  // `GetTextSize`: letter-spaced text is measured a character at a time.
  let lineWidth = 0;
  if (font.letterSpacing === 0) lineWidth = ctx.measureText(text).width;
  else {
    for (const char of text.split("")) lineWidth += ctx.measureText(char).width;
    if (text.length > 1) lineWidth += font.letterSpacing * (text.length - 1);
  }
  const metrics = ctx.measureText(TEST_STRING);
  const ascent = metrics.actualBoundingBoxAscent ?? size * 0.8;
  const descent = metrics.actualBoundingBoxDescent ?? size * 0.2;
  return {
    text,
    font: css,
    letterSpacing: font.letterSpacing,
    width: Math.ceil(lineWidth) + font.padRight,
    height: ascent + descent,
    baseline: Math.round(ascent),
  };
}

/**
 * `ui/widgets.ts`'s `fitText`, over a measuring function instead of a live `Text`: the largest size from `startSize`
 * down to `floor` at which `text` fits `maxWidth`, else the floor (or `startSize`, if that is already below it) with
 * the text cut to the longest prefix that fits with an ellipsis.
 */
export function fitLine(
  measure: (text: string, size: number) => { readonly width: number },
  text: string,
  maxWidth: number,
  startSize: number,
  floor: number,
): { readonly text: string; readonly size: number } {
  if (measure(text, startSize).width <= maxWidth) return { text, size: startSize };
  let low = floor;
  let high = startSize - 1;
  let fits: number | null = null;
  while (low <= high) {
    const size = (low + high) >> 1;
    if (measure(text, size).width <= maxWidth) {
      fits = size;
      low = size + 1;
    } else {
      high = size - 1;
    }
  }
  if (fits !== null) return { text, size: fits };

  const size = Math.min(floor, startSize);
  const clipped = (length: number): string => `${text.slice(0, length).trimEnd()}…`;
  let short = 1;
  let long = text.length - 1;
  let best = 1;
  while (short <= long) {
    const length = (short + long) >> 1;
    if (measure(clipped(length), size).width <= maxWidth) {
      best = length;
      short = length + 1;
    } else {
      long = length - 1;
    }
  }
  return { text: clipped(best), size };
}

function fitBox(
  ctx: FaceContext,
  text: string,
  font: FaceFont,
  maxWidth: number,
  startSize: number,
  spec: CardFaceSpec,
): TextBox {
  const measure = (t: string, size: number): TextBox => measureBox(ctx, t, font, size, spec.desktop);
  const fitted = fitLine(measure, text, maxWidth, startSize, spec.captionFloor);
  return measure(fitted.text, fitted.size);
}

/** `Text.updateText`'s fill: one `fillText` for the line, or one per character when letter-spaced. */
function drawBox(ctx: FaceContext, box: TextBox, x: number, top: number, color: string): void {
  ctx.font = box.font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  const y = top + box.baseline;
  if (box.letterSpacing === 0) {
    ctx.fillText(box.text, x, y);
    return;
  }
  let offset = 0;
  for (const char of box.text.split("")) {
    ctx.fillText(char, x + offset, y);
    offset += ctx.measureText(char).width + box.letterSpacing;
  }
}

/** A CSS colour at `alpha`, the way `cssOf` would write it (colours arrive as `#rrggbb`). */
export function withAlpha(hex: string, alpha: number): string {
  if (alpha >= 1) return hex;
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 0xff},${(value >> 8) & 0xff},${value & 0xff},${alpha})`;
}

/** The footer band's height, from the title size as asked for (not as drawn — `renderShelfCard` never bumped it). */
export const footerHeightOf = (spec: CardFaceSpec): number => spec.titleFont.size + 8 + 16 + 8;

/**
 * Paints `spec` at (0, 0), in game pixels (the caller scales the context by `spec.resolution`). `art` is the
 * decoded art, at any size: it is cropped in its own pixels, so a bitmap already downscaled for this card crops the
 * same as the full picture would.
 */
export function paintCardFace(
  ctx: FaceContext,
  spec: CardFaceSpec,
  art: { readonly width: number; readonly height: number; readonly source: CanvasImageSource } | null,
): void {
  const { width, height, dim, colors } = spec;
  const footerHeight = footerHeightOf(spec);

  ctx.fillStyle = withAlpha(colors.card, dim);
  ctx.fillRect(0, 0, width, height);

  const artHeight = height - footerHeight;
  if (art && art.width > 0 && art.height > 0) {
    ctx.save();
    ctx.globalAlpha = dim;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const place = artPlacement(art, { width, height: artHeight }, spec.artFit, spec.artFocusY);
    ctx.drawImage(art.source, place.sx, place.sy, place.sw, place.sh, place.dx, place.dy, place.dw, place.dh);
    ctx.restore();
  } else {
    ctx.fillStyle = withAlpha(colors.parchment, dim);
    ctx.fillRect(0, 0, width, artHeight);
  }

  const textX = 8;
  const textWidth = width - 16;
  const textY = artHeight + 8;
  const title = fitBox(ctx, spec.title, spec.titleFont, textWidth, spec.titleFont.size, spec);
  drawBox(ctx, title, textX, textY, withAlpha(colors.ink, dim));
  const subtitleText = spec.subtitleFont.uppercase ? spec.subtitle.toUpperCase() : spec.subtitle;
  const subtitle = fitBox(ctx, subtitleText, spec.subtitleFont, textWidth, spec.subtitleFitStart, spec);
  drawBox(ctx, subtitle, textX, textY + title.height + 3, withAlpha(spec.subtitleColor, spec.subtitleAlpha));

  let stampX = 8;
  for (const stamp of spec.stamps) {
    const text = spec.stampFont.uppercase ? stamp.label.toUpperCase() : stamp.label;
    const box = measureBox(ctx, text, spec.stampFont, spec.stampFont.size, spec.desktop);
    const stampWidth = Math.ceil(box.width) + 16;
    const stampHeight = 24;
    if (stampX + stampWidth > width - 8) break;
    const y = artHeight - stampHeight - 8;
    ctx.fillStyle = withAlpha(stamp.fill, dim);
    ctx.fillRect(stampX, y, stampWidth, stampHeight);
    ctx.strokeStyle = withAlpha(colors.ink, dim);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(stampX + 0.75, y + 0.75, stampWidth - 1.5, stampHeight - 1.5);
    drawBox(ctx, box, stampX + 8, y + stampHeight / 2 - box.height / 2, withAlpha(stamp.ink, dim));
    stampX += stampWidth + 4;
  }

  if (spec.selected) {
    ctx.strokeStyle = colors.heroRed;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);
  } else {
    ctx.strokeStyle = withAlpha(colors.ink, spec.blocked ? dim : spec.inkLabel);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, width - 1.5, height - 1.5);
  }

  if (spec.tag) {
    // Sized to the label as measured. The game-object card guessed `length * 6 + 16`, which the desktop type bump
    // outgrew: "SELECTED" and "LOCKED" ran past their red plate and off the card's edge.
    const text = spec.tagFont.uppercase ? spec.tag.toUpperCase() : spec.tag;
    const box = measureBox(ctx, text, spec.tagFont, spec.tagFont.size, spec.desktop);
    const tagWidth = Math.min(width - 8, Math.max(spec.tag.length * 6 + 16, box.width + 8));
    ctx.fillStyle = colors.heroRed;
    ctx.fillRect(width - tagWidth, 0, tagWidth, 16);
    drawBox(ctx, box, width - tagWidth + 4, 2, colors.paper);
  }
}

/** `art/card-art.ts`'s `drawArt` geometry, as a `drawImage` source and destination rectangle. */
export function artPlacement(
  source: { readonly width: number; readonly height: number },
  slot: { readonly width: number; readonly height: number },
  fit: "cover" | "contain",
  focusY: number,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const { width: sourceWidth, height: sourceHeight } = source;
  if (fit === "contain") {
    const scale = Math.min(slot.width / sourceWidth, slot.height / sourceHeight);
    const dw = sourceWidth * scale;
    const dh = sourceHeight * scale;
    return {
      sx: 0,
      sy: 0,
      sw: sourceWidth,
      sh: sourceHeight,
      dx: (slot.width - dw) / 2,
      dy: (slot.height - dh) / 2,
      dw,
      dh,
    };
  }
  const scale = Math.max(slot.width / sourceWidth, slot.height / sourceHeight);
  const sw = Math.min(sourceWidth, slot.width / scale);
  const sh = Math.min(sourceHeight, slot.height / scale);
  const sx = (sourceWidth - sw) / 2;
  const sy = Math.max(0, Math.min(sourceHeight - sh, (sourceHeight - sh) * focusY));
  return { sx, sy, sw, sh, dx: 0, dy: 0, dw: sw * scale, dh: sh * scale };
}

/** The size to decode `source` at so it still covers (or fits) `slot` at `resolution` — never larger than itself. */
export function artDecodeSize(
  source: { readonly width: number; readonly height: number },
  slot: { readonly width: number; readonly height: number },
  fit: "cover" | "contain",
  resolution: number,
): { readonly width: number; readonly height: number } {
  const scale =
    fit === "cover"
      ? Math.max(slot.width / source.width, slot.height / source.height)
      : Math.min(slot.width / source.width, slot.height / source.height);
  const factor = Math.min(1, scale * resolution);
  return {
    width: Math.max(1, Math.ceil(source.width * factor)),
    height: Math.max(1, Math.ceil(source.height * factor)),
  };
}
