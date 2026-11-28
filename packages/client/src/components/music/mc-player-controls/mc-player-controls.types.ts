import type { ControlGlyphs } from "@mc/ui";

/** The properties of `mc-player-controls`: Shuffle and Next side by side, then Pause (with the volume slider beside it). */
export interface McPlayerControlsProps {
  /** The words on the buttons, already translated. */
  shuffleLabel: string;
  nextLabel: string;
  pauseLabel: string;
  /** Shuffle is on: its button reads as chosen. */
  shuffleOn: boolean;
  /** Paused: the Pause button reads as chosen (and says Play). */
  paused: boolean;
  /** Why Shuffle and Next are unavailable (no song earned yet); empty when they are available. */
  reason: string;
  /** A slider is slotted beside Pause, which then takes a fixed width rather than the whole row. */
  withSlider: boolean;
  /** The key or pad glyphs hung on the buttons, by key (`shuffle`, `next`, `pause`); none on touch or a mouse. */
  glyphs: ControlGlyphs;
}
