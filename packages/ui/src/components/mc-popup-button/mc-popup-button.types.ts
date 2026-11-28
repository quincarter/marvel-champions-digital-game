import type { ControlGlyph, PopupButton } from "../../shared/popup.types.js";

/** What an `mc-popup-button` is given: the button's words and look, and the glyph hung on it (or null). */
export interface PopupButtonInput {
  readonly button: PopupButton;
  readonly glyph: ControlGlyph | null;
}
