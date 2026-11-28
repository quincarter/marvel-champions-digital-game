/** The volume slider: a − button, a track with a knob, a + button and the percent it reads. */
export interface VolumeSliderProps {
  /** 0 to 100. */
  readonly value: number;
  /** What it reads at the right ("70%"). */
  readonly label: string;
  /** The words for the − and + buttons, for assistive tech. */
  readonly stepLabels: readonly [string, string];
}
