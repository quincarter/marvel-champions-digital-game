/** One aspect's chip along a hero picture's foot: the aspect, and the three ways its name can be said by the room it has. */
export interface AspectBadge {
  /** The core aspect's id ("justice"): the chip's colours are the panel layer's `--mc-fill-<id>` and `--mc-text-on-<id>`. */
  readonly id: string;
  /** The aspect's name in capitals, its three-letter code and its first letter. Never colour alone. */
  readonly full: string;
  readonly code: string;
  readonly letter: string;
}

export interface McPastGameAspectsProps {
  readonly badges: readonly AspectBadge[];
}
