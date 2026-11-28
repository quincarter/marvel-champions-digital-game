/** One reward the seat chose, in the deck or not. */
export interface RewardModel {
  readonly cardId: string;
  readonly name: string;
  /** In words: "In your deck" / "Left out". */
  readonly status: string;
  readonly included: boolean;
  /** The button's words: what pressing does ("Leave out" / "Put back"). */
  readonly toggleLabel: string;
  /** Why the button does nothing now (a save in flight, a frozen deck); null when it is live. */
  readonly disabled: string | true | null;
}

/** Campaign mode's rewards strip (MC45 p. 24; owner decision, 2026-10-08). */
export interface RewardsModel {
  readonly label: string;
  readonly rewards: readonly RewardModel[];
}
