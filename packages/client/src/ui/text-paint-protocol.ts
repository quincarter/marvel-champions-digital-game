/**
 * What the main thread and the text-paint worker (`workers/text-paint.worker.ts`) say to each other.
 *
 * A job is everything `Text.updateText` draws, already decided: the lines with their positions, the font and the
 * colors. The worker measures nothing, so a label's size, which layout reads synchronously, never depends on it.
 */
import type { FontSource } from "../art/card-face-protocol.js";

export interface PaintShadow {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly color: string;
  readonly blur: number;
  /** `style.shadowFill` / `style.shadowStroke`: whether the shadow is on for that pass. */
  readonly fill: boolean;
  readonly stroke: boolean;
}

export interface PaintLine {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

export interface PaintJob {
  readonly id: number;
  /** The bitmap's size in device pixels (what `canvas.width` becomes: truncated). */
  readonly width: number;
  readonly height: number;
  readonly resolution: number;
  /** The canvas font string. */
  readonly font: string;
  readonly background: string | null;
  readonly paddingLeft: number;
  readonly paddingTop: number;
  /** `style.color`; an empty string draws no fill. */
  readonly fill: string;
  readonly stroke: string;
  readonly strokeThickness: number;
  readonly letterSpacing: number;
  readonly shadow: PaintShadow;
  readonly lines: readonly PaintLine[];
}

export type TextPaintRequest =
  | { readonly type: "init"; readonly fonts: readonly FontSource[] }
  | { readonly type: "paint"; readonly jobs: readonly PaintJob[] };

export type TextPaintResponse =
  | { readonly type: "ready"; readonly ok: boolean; readonly reason?: string }
  | { readonly type: "painted"; readonly results: readonly { readonly id: number; readonly bitmap: ImageBitmap }[] }
  | { readonly type: "failed"; readonly ids: readonly number[]; readonly reason: string };
