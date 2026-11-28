/** The properties of `mc-continue-bar`. */
export interface ContinueBarProps {
  /** "Continue learning ▸", "Play it again ▸", or "Suiting up…" while it waits, already translated. */
  readonly label: string;
  /** The tutorial game is being made: the button is dimmed. */
  readonly starting: boolean;
}
