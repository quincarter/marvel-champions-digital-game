import type { ControlGlyph } from "../../../shared/popup.types.js";

/** The properties of `mc-close-bar`. */
export interface McCloseBarProps {
  /** The bar's title, already translated. */
  readonly heading: string;
  /** The close control's accessible name ("Back"), already translated. */
  readonly closeLabel: string;
  /** The close control's focus stop key. */
  readonly closeStop: string;
  /** The Cancel glyph hung after the title while a keyboard or pad is in use. */
  readonly glyph: ControlGlyph | undefined;
  /** How far the title drops under the dark mode tab, in px. */
  readonly drop: number;
  /** The width the title may take, in px (0: no limit). */
  readonly max: number;
}

/** What a tap on the close control raises as its `mc-pressed` action. */
export const CLOSE_BAR_ACTION = "close";
