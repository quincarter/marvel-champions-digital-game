/** The event every pressable control raises: a tap, a press by the focus route, or a hold (Inspect). */
export const PRESS_EVENT = "mc-pressed";

/**
 * What `mc-pressed` carries: the `action` the owner gave the control (it means nothing to the control; the owner's
 * section turns it into its own event) and whether it was a hold (`holdAction`) rather than a tap (`action`).
 */
export interface PressDetail {
  readonly action: unknown;
  readonly hold: boolean;
}

export type PressEvent = CustomEvent<PressDetail>;

declare global {
  interface HTMLElementEventMap {
    "mc-pressed": PressEvent;
  }
}
