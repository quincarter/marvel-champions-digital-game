/**
 * The draw odds (issue #531): a group stepper (< Gives physical >, Resource cards, a trait, a title ...), a draw count
 * stepper starting at the alter ego's hand size, then the chance of drawing 0, 1, 2 and 3+ of the group and of at least one.
 */
export interface OddsModel {
  /** What to say with nothing to measure (an empty deck); null otherwise. */
  readonly empty: string | null;
  /** "Gives physical · 8". */
  readonly group: string;
  /** "Draw 6 (opening hand)". */
  readonly draws: string;
  readonly canFewer: boolean;
  readonly canMore: boolean;
  /** "0: 12%   1: 40%   2: 30%   3+: 18%". */
  readonly line: string;
  /** "At least one: 88%". */
  readonly atLeast: string;
}
