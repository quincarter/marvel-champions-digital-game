/** What the deal bar shows: the one red action, why it waits, and the line over it. */
export interface DealBarInput {
  /** "Dealing it out" is under way: Deal waits. */
  readonly starting: boolean;
  /** A room's table: Deal returns to the lobby, so it says "Back to the room". */
  readonly room: boolean;
  /** Why Deal waits (the modular picks, a builder refusal), or null when it can deal. */
  readonly blocked: string | null;
  /** The line over Deal (a seed that is not a number, a failed setup); empty for none. */
  readonly status: string;
  /** The phone footer's one summary line ("Rhino - Stage I - Standard - 1 hero - 1 modular"). */
  readonly footerLine: string;
}
