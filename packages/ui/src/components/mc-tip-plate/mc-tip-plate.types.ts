import type { TipRect } from "../../shared/tip-placement.js";

/** The properties of `mc-tip-plate`: a short tip on a plate beside the thing it explains. */
export interface McTipPlateProps {
  /** The tip's words, already translated. */
  text: string;
  /** The thing the tip explains, in the plate's offset parent's coordinates; null: no plate. */
  anchor: TipRect | null;
  /** The box the plate must stay inside, in the same coordinates. */
  viewport: TipRect;
}

/** `mc-tip-dismiss`: a tap on the plate (it takes the press, so nothing beneath is pressed). */
export type McTipPlateDismissDetail = Record<string, never>;

declare global {
  interface HTMLElementEventMap {
    "mc-tip-dismiss": CustomEvent<McTipPlateDismissDetail>;
  }
}
