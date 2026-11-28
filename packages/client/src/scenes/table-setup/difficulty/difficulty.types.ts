import type { DifficultyCard } from "../../../view/table-setup-preview.js";
import type { SetupOptionRow } from "../../../view/setup-options.js";

/** What the Difficulty section shows: the cards, the set choices folded into the row, the option cards and Tower Defense's toggle. */
export interface DifficultyInput {
  readonly cards: readonly DifficultyCard[];
  readonly selected: string;
  /** The Standard / Expert set rows, for the chips in the row's spare slot. */
  readonly setChoices: readonly SetupOptionRow[];
  /** The other setup options the scenario offers, one card each. */
  readonly optionRows: readonly SetupOptionRow[];
  /** Tower Defense's "Black Order's initial attack"; `offered` is false for every other scenario. */
  readonly towerDefense: { readonly offered: boolean; readonly on: boolean; readonly perHero: number };
}

/** What the player changed in the Difficulty section. */
export interface DifficultyEvents {
  readonly pick: (difficultyId: string) => void;
  /** A chip, stepper or toggle of an option card: its action string (`applySetupOption`). */
  readonly option: (action: string) => void;
  /** "Cards" on the Standard / Expert set row: one sheet of every set the rows offer. */
  readonly setsSheet: () => void;
  readonly toggleTowerDefense: () => void;
}
