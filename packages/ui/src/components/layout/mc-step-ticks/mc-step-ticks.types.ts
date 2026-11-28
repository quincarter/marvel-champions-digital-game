/** The properties of `mc-step-ticks`. */
export interface McStepTicksProps {
  /** How many ticks. */
  readonly count: number;
  /** How many are filled, from the first. */
  readonly filled: number;
  /** The strip's accessible name, already translated. */
  readonly label: string;
}
