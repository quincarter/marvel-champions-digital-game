import type { ControlGlyph } from "../../../shared/popup.types.js";

export interface McStepperProps {
  /** What is chosen, already translated: the middle chip's words. */
  label: string;
  /** The previous and next arrows' focus stops (`data-stop`). */
  prevStop: string;
  nextStop: string;
  /** The middle chip's focus stop; empty for none (it takes no press). */
  nameStop: string;
  /** What a tap on an arrow raises as `mc-pressed`'s `action`. */
  prevAction: unknown;
  nextAction: unknown;
  /** The key or pad glyph on an arrow (LT, RT), while a keyboard or pad is in use. */
  prevGlyph: ControlGlyph | undefined;
  nextGlyph: ControlGlyph | undefined;
  /** Whether there is anywhere to step to: with one choice the arrows are dimmed and the chip stands alone. */
  several: boolean;
}
