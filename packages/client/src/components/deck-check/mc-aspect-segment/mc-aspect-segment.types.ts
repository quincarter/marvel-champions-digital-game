/** One aspect of the rail: its name, whether the deck uses it, and the "i" that opens its tip. */
export interface AspectSegmentModel {
  /** The aspect's id (`aggression`, `pool`, ...). */
  readonly aspect: string;
  /** Its name, already translated. */
  readonly label: string;
  /** The deck is built with it. */
  readonly chosen: boolean;
  /** The "i" button's accessible name (the tip's title); empty when the aspect has no tip. */
  readonly tipLabel: string;
}

export interface McAspectSegmentProps extends AspectSegmentModel {
  /** This aspect's tip is open (the "i" reads pressed). */
  tipOpen: boolean;
}
