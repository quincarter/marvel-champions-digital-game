import type { GlyphSpec, McGlyphGround } from "./glyph.types.js";

/** `mc-activate`'s detail: the key of the control that was pressed (a focus stop's key). */
export interface ActivateDetail {
  readonly key: string;
}

/** `mc-slide`'s detail: a press or drag along a slider's track. `commit` is the release (the value is final). */
export interface SlideDetail {
  readonly key: string;
  /** 0 to 1 along the track. */
  readonly share: number;
  readonly commit: boolean;
}

/** `mc-step`'s detail: a slider's minus (-1) or plus (1) was pressed. */
export interface StepDetail {
  readonly key: string;
  readonly direction: -1 | 1;
}

/** A key or pad glyph hung under a control while a keyboard or pad is the input in use. */
export interface ControlGlyph {
  readonly specs: readonly GlyphSpec[];
  readonly height: number;
  readonly ground: McGlyphGround;
  /** 0 (folded away) to 1 (open). */
  readonly openness: number;
  readonly still?: boolean;
  /** Where it hangs: inside the control at its left (beside the word), or outside, to its left (a small control). */
  readonly place?: "inside" | "left";
  /** The glyph's drawn width in px: an inside glyph slides the control's word over by half of it. */
  readonly width?: number;
}

/** The glyphs of a popup's controls, by the control's key. */
export type ControlGlyphs = Readonly<Record<string, ControlGlyph>>;

/** A button a popup draws: what it says and how it looks. */
export interface PopupButton {
  readonly key: string;
  readonly label: string;
  readonly kind: "primary" | "secondary" | "quiet" | "onInk";
  readonly selected?: boolean;
  /** Unavailable: dimmed, presses do nothing; this says why. */
  readonly disabled?: string;
}
