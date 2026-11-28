/** The properties of `mc-progress-bar`: a track with a Hero Red fill. */
export interface McProgressBarProps {
  /** How far along, 0 to 1 (clamped). */
  fraction: number;
  /** The words a screen reader hears ("3 / 10"), already translated; the bar draws none. */
  label: string;
}
