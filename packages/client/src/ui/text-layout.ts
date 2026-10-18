/**
 * The measuring half of `Text.updateText`, as a pure function.
 *
 * Phaser lays a label out and paints it in one method. Layout (the label's width and height, and where each line
 * starts) has to stay on the main thread, because `fitText`, `setOrigin` and the sizers read it straight away. This
 * is that half, copied from Phaser 4.2's `Text.updateText` and `GetTextSize` for the cases the worker paints (left,
 * center and right alignment, left to right); the painting half is `workers/text-paint.worker.ts`. A change to the
 * Phaser version should be checked against `text-layout.test.ts`.
 */
import type { PaintLine } from "./text-paint-protocol.js";

export interface LayoutInput {
  /** The wrapped text split into lines. */
  readonly lines: readonly string[];
  readonly metrics: { readonly ascent: number; readonly fontSize: number };
  readonly strokeThickness: number;
  readonly letterSpacing: number;
  readonly lineSpacing: number;
  readonly maxLines: number;
  readonly fixedWidth: number;
  readonly fixedHeight: number;
  readonly padding: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };
  readonly align: "left" | "center" | "right";
  readonly resolution: number;
  readonly autoRound: boolean;
}

export interface Layout {
  /** The label's `width` and `height` in layout pixels. */
  readonly width: number;
  readonly height: number;
  /** Canvas size before truncation, as `Text.updateText` passes it to the frame. */
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly lines: readonly PaintLine[];
}

export function layoutText(input: LayoutInput, widthOf: (text: string) => number): Layout {
  const { strokeThickness, letterSpacing, padding } = input;
  const drawn = input.maxLines > 0 && input.maxLines < input.lines.length ? input.maxLines : input.lines.length;

  const lineWidths: number[] = [];
  let widest = 0;
  for (let i = 0; i < drawn; i++) {
    const line = input.lines[i]!;
    let lineWidth = strokeThickness;
    if (letterSpacing === 0) {
      lineWidth += widthOf(line);
    } else {
      for (const char of line.split("")) lineWidth += widthOf(char);
      if (line.length > 1) lineWidth += letterSpacing * (line.length - 1);
    }
    lineWidths[i] = Math.ceil(lineWidth);
    widest = Math.max(widest, lineWidths[i]!);
  }

  const lineHeight = input.metrics.fontSize + strokeThickness;
  let textHeight = lineHeight * drawn;
  if (drawn > 1) textHeight += input.lineSpacing * (drawn - 1);

  let width: number;
  let textWidth: number;
  if (input.fixedWidth === 0) {
    width = widest + padding.left + padding.right;
    textWidth = widest;
  } else {
    width = input.fixedWidth;
    textWidth = Math.max(width - padding.left - padding.right, widest);
  }
  const height = input.fixedHeight === 0 ? textHeight + padding.top + padding.bottom : input.fixedHeight;

  const lines: PaintLine[] = [];
  for (let i = 0; i < drawn; i++) {
    let x = strokeThickness / 2;
    let y = strokeThickness / 2 + i * lineHeight + input.metrics.ascent;
    if (i > 0) y += input.lineSpacing * i;
    if (input.align === "right") x += textWidth - lineWidths[i]!;
    else if (input.align === "center") x += (textWidth - lineWidths[i]!) / 2;
    if (input.autoRound) {
      x = Math.round(x);
      y = Math.round(y);
    }
    lines.push({ text: input.lines[i]!, x, y });
  }

  return {
    width,
    height,
    canvasWidth: Math.max(width * input.resolution, 1),
    canvasHeight: Math.max(height * input.resolution, 1),
    lines,
  };
}

/** The first family of a CSS `font-family` list, unquoted: `"Public Sans", sans-serif` is `Public Sans`. */
export function primaryFamily(fontFamily: string): string {
  const first = fontFamily.split(",")[0]!.trim();
  return first.replace(/^["']|["']$/g, "");
}

export interface WorkerPaintStyle {
  readonly rtl: boolean;
  readonly align: string;
  readonly wordWrapCallback: unknown;
  readonly fontFamily: string;
  readonly resolution: number;
}

/**
 * Whether the worker paints a label with this style exactly as Phaser would. Anything unusual stays on the main
 * thread: right-to-left, justified text (it re-measures spaces while painting), a wrap callback (arbitrary code that
 * receives the label), or a face the worker was not given.
 */
export function workerCanPaint(style: WorkerPaintStyle, families: ReadonlySet<string>): boolean {
  if (style.rtl || style.wordWrapCallback) return false;
  if (style.align !== "left" && style.align !== "center" && style.align !== "right") return false;
  if (!(style.resolution > 0)) return false;
  return families.has(primaryFamily(style.fontFamily));
}

/**
 * Line widths by font and text, so a label whose text was measured before (a stat, a button word, a repeated card
 * name) skips `context.measureText`. A width is only remembered once the browser has the font's faces for that text,
 * the same rule `font-metrics.ts` uses, and the map is cleared rather than grown without bound.
 */
export class WidthCache {
  readonly #known = new Map<string, number>();
  readonly #ready: (font: string, text: string) => boolean;
  readonly #limit: number;
  hits = 0;
  misses = 0;

  constructor(ready: (font: string, text: string) => boolean, limit = 6000) {
    this.#ready = ready;
    this.#limit = limit;
  }

  widthOf(font: string, text: string, measure: () => number): number {
    const key = `${font}\u0000${text}`;
    const known = this.#known.get(key);
    if (known !== undefined) {
      this.hits++;
      return known;
    }
    this.misses++;
    const width = measure();
    if (this.#ready(font, text)) {
      if (this.#known.size >= this.#limit) this.#known.clear();
      this.#known.set(key, width);
    }
    return width;
  }
}
