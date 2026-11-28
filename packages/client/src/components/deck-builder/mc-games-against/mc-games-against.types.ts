/** The villain stepper: the headline names the villain faced; Previous / Next walk the list (129 villains is too many presses). */
export interface AgainstStepperModel {
  readonly headline: string;
  /** More than one villain to step through: the stepper has arrows and a live name; else it is a dimmed label. */
  readonly steppable: boolean;
  readonly previousLabel: string;
}

/** Whose decks the block reads: yours, or everyone's. */
export interface AgainstSourceModel {
  readonly id: "yours" | "everyone";
  readonly label: string;
  readonly chosen: boolean;
}

/** "Share my games" (Everyone, sharing off): one press turns it on. */
export interface AgainstShareModel {
  readonly label: string;
  readonly line: string;
}

/** The Against block of "From your games": which villain, whose decks, and what it can say. */
export interface GamesAgainstModel {
  /** Null while no villain has been faced (the sources and their note still show). */
  readonly stepper: AgainstStepperModel | null;
  readonly sources: readonly AgainstSourceModel[];
  /** Why there is nothing to read yet ("finish a game", "reading", "unavailable", "stale"); null for none. */
  readonly note: string | null;
  readonly share: AgainstShareModel | null;
}
