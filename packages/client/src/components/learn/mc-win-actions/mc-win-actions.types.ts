/** The properties of `mc-win-actions`. */
export interface WinActionsProps {
  /** "Tell me more", already translated. */
  readonly tellLabel: string;
  /** "Start the fight ▸", or "Suiting up…" while it waits, already translated. */
  readonly startLabel: string;
  /** The tutorial game is being made: Start is dimmed and not a stop. */
  readonly starting: boolean;
}
