/**
 * The bridge from design tokens to Phaser drawing calls.
 *
 * Every widget goes through here, so the state matrix in Components.dc.html
 * section 03 is implemented once: rest / hover / selected / unavailable, solid
 * border = available, dashed = not yet real, 40% ink = illegal right now.
 * Hover swaps ground and ink and never moves or scales an element — that is a
 * stated rule of the system, and it is enforced by the fact that nothing here
 * returns a scale or an offset.
 */

import type Phaser from "phaser";
import { accent, border, font, ink, surface, type TypeSpec } from "../tokens.js";

/**
 * Bangers is a hand-lettered, slanted face — its rightmost glyphs (the tail of a
 * cursive "T", the lean on "Y"/"D"/"N"…) draw past the metrics-reported advance
 * width Phaser measures the text box from, so a right-aligned or tightly-fit
 * container clips them ("READY", "EXHAUSTED", "DISCOUNT" losing their last
 * glyph's right edge — found on the Rules overlay's Card list/Glossary tabs).
 * A few px of right padding gives the slant somewhere to draw without changing
 * the glyphs' own left-origin position (Phaser's text canvas only grows to the
 * right when `padding.left` is 0, so origin-0 callers never shift).
 */
const BANGERS_RIGHT_PADDING = 6;

/** The four states every control can be in. */
export type WidgetState = "rest" | "hover" | "selected" | "unavailable";

/** What a control looks like in one state: two colours and a border. */
export interface Skin {
  readonly fill: number;
  readonly fillAlpha: number;
  readonly text: number;
  readonly textAlpha: number;
  readonly stroke: number;
  readonly strokeWidth: number;
  /** Drawn dashed when the slot isn't filled yet (an empty seat, a locked mode). */
  readonly dashed: boolean;
}

export type WidgetKind =
  /** The single forward action on the screen. One per screen, by rule. */
  | "primary"
  /** An ordinary control on paper. */
  | "secondary"
  /** A low-commitment alternative ("Skip"). */
  | "quiet"
  /** A control on the ink action bar. */
  | "onInk"
  /** A card, row or tile lifted off the paper. */
  | "card"
  /** A recessed strip: tab rails, seat rows. */
  | "rail";

const solid = (fill: number, text: number, stroke: number, strokeWidth: number): Skin => ({
  fill,
  fillAlpha: 1,
  text,
  textAlpha: ink.body,
  stroke,
  strokeWidth,
  dashed: false,
});

/**
 * The state matrix. `unavailable` never hides anything: it keeps the control in
 * place and drops its ink, because the board must not reflow while the player
 * is deciding ("dim, don't hide").
 */
export function skin(kind: WidgetKind, state: WidgetState): Skin {
  switch (kind) {
    case "primary":
      switch (state) {
        case "hover":
          return solid(accent.redDeep.hex, surface.paper.hex, accent.redDeep.hex, border.object);
        case "unavailable":
          return { ...solid(surface.paper.hex, surface.ink.hex, surface.ink.hex, border.object), textAlpha: ink.disabled };
        default:
          return solid(accent.heroRed.hex, surface.paper.hex, accent.heroRed.hex, border.object);
      }
    case "secondary":
      switch (state) {
        case "hover":
          // Ground and ink swap; nothing moves.
          return solid(surface.ink.hex, surface.paper.hex, surface.ink.hex, border.control);
        case "selected":
          return solid(surface.ink.hex, surface.paper.hex, surface.ink.hex, border.control);
        case "unavailable":
          return { ...solid(surface.paper.hex, surface.ink.hex, surface.ink.hex, border.control), textAlpha: ink.disabled };
        default:
          return solid(surface.paper.hex, surface.ink.hex, surface.ink.hex, border.control);
      }
    case "quiet":
      switch (state) {
        case "hover":
          return { ...solid(surface.parchment.hex, surface.ink.hex, surface.ink.hex, border.detail), textAlpha: ink.body };
        case "unavailable":
          return { ...solid(surface.paper.hex, surface.ink.hex, surface.ink.hex, border.detail), textAlpha: ink.disabled, dashed: true };
        default:
          return { ...solid(surface.paper.hex, surface.ink.hex, surface.ink.hex, border.detail), textAlpha: ink.secondary };
      }
    case "onInk":
      switch (state) {
        case "hover":
          // Ability buttons invert to red to preview the target-select mode.
          return solid(accent.heroRed.hex, surface.paper.hex, accent.heroRed.hex, border.control);
        case "selected":
          return solid(accent.heroRed.hex, surface.paper.hex, accent.heroRed.hex, border.control);
        case "unavailable":
          return { ...solid(surface.ink.hex, surface.paper.hex, surface.paper.hex, border.control), textAlpha: ink.disabled };
        default:
          return { ...solid(surface.ink.hex, surface.paper.hex, surface.paper.hex, border.control), textAlpha: ink.body };
      }
    case "card":
      switch (state) {
        case "hover":
          return solid(surface.card.hex, surface.ink.hex, accent.heroRed.hex, border.object);
        case "selected":
          return solid(surface.card.hex, surface.ink.hex, accent.heroRed.hex, border.object);
        case "unavailable":
          // Present but illegal this instant: 38% ink, still exactly in place.
          return { ...solid(surface.card.hex, surface.ink.hex, surface.ink.hex, border.object), fillAlpha: ink.illegal, textAlpha: ink.illegal };
        default:
          return solid(surface.card.hex, surface.ink.hex, surface.ink.hex, border.object);
      }
    case "rail":
      return state === "selected"
        // Active tab = ink fill, not an underline.
        ? solid(surface.ink.hex, surface.paper.hex, surface.ink.hex, border.detail)
        : { ...solid(surface.parchment.hex, surface.ink.hex, surface.ink.hex, border.detail), textAlpha: ink.label };
  }
}

/**
 * Text resolution. Phaser 4 has no game-level text resolution, so it is set per
 * text object — which means it belongs here, where every text object in the app
 * is created, rather than being repeated in each scene.
 */
let textResolution = 1;

export function setTextResolution(value: number): void {
  textResolution = value;
}

/**
 * A `TypeSpec`'s font stack as a CSS `font-family` value, shared by every
 * text object Phaser draws and by the one DOM element in the app
 * (`McTextInput`'s rexUI `InputText`), so a seed field's digits render in the
 * same mono face as the rest of the app's specs and tokens.
 */
export function fontFamilyOf(spec: TypeSpec): string {
  return `"${spec.family}", ${spec.family === font.mono ? "monospace" : "sans-serif"}`;
}

/** A `TypeSpec` as a Phaser text style. */
export function textStyle(spec: TypeSpec, color: number, alpha = 1): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: fontFamilyOf(spec),
    fontSize: `${spec.size}px`,
    fontStyle: spec.weight === 400 ? "normal" : `${spec.weight}`,
    color: cssOf(color, alpha),
    resolution: textResolution,
    ...(spec.family === font.display ? { padding: { right: BANGERS_RIGHT_PADDING } } : {}),
  };
}

/** A Phaser colour number as a CSS string, optionally with alpha. */
export function cssOf(color: number, alpha = 1): string {
  const hex = `#${color.toString(16).padStart(6, "0")}`;
  if (alpha >= 1) return hex;
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Uppercases per the type spec, so a label is never shouted by accident. */
export const caseOf = (spec: TypeSpec, text: string): string => (spec.uppercase ? text.toUpperCase() : text);
