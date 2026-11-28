/**
 * Where a rebuilt screen's ink top bar puts its title: the dark mode tab hangs from the top centre of the screen, so the
 * title drops under it or ends before it (`sheetThemeFor`). Past games and the Trophy Room share this one rule. The words'
 * widths are measured in the display face (the bar prints them in it); without a canvas the old estimate stands in.
 */
import type Phaser from "phaser";
import { font } from "../tokens.js";
import { estimateBangersWidth, sheetThemeFor } from "../ui/campaign-chrome.js";

/** The bar's height: 60px, and 52px on a phone (`CAMPAIGN_TOP_BAR`). */
export const barHeightOf = (phone: boolean): number => (phone ? 52 : 60);

let canvas: CanvasRenderingContext2D | null | undefined;

/** The width of `text` in the display face at `size`px with `spacing`px between letters. */
export function displayWidthOf(text: string, size: number, spacing: number): number {
  if (canvas === undefined) {
    canvas = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  }
  if (!canvas) return estimateBangersWidth(text, size) + spacing * text.length;
  canvas.font = `${size}px "${font.display}", sans-serif`;
  return canvas.measureText(text).width + spacing * text.length;
}

export interface BarClearanceInput {
  readonly width: number;
  readonly phone: boolean;
  /** The Back button's word and the title, as the bar prints them. */
  readonly back: string;
  readonly title: string;
  /** The room the control at the bar's right end takes (its width and the gap before it). */
  readonly endWidth: number;
  /** Back carries a key or pad glyph beside its word (a wide bar while a keyboard or pad is in use). */
  readonly backGlyph: boolean;
}

/** How far the title drops, and where it must end (px from the bar's left edge; 0 for no limit). */
export function barClearanceOf(
  scene: Phaser.Scene,
  input: BarClearanceInput,
): { readonly drop: number; readonly maxRight: number } {
  const { width, phone, back, title, endWidth } = input;
  const pad = phone ? 12 : 22;
  const gap = phone ? 12 : 14;
  const backWidth = Math.max(phone ? 44 : 76, displayWidthOf(back, 18, 2) + 26 + (input.backGlyph && !phone ? 40 : 0));
  const x = pad + backWidth + gap;
  const size = phone ? 22 : 28;
  const room = width - pad - endWidth - x;
  const barHeight = barHeightOf(phone);
  const { drop, maxRight } = sheetThemeFor(scene, {
    width,
    textLeft: x,
    textRight: x + Math.min(room, displayWidthOf(title.toUpperCase(), size, 1)),
    textTop: barHeight / 2 - size / 2,
    textHeight: size,
    barHeight,
  });
  return { drop, maxRight: maxRight ?? 0 };
}
