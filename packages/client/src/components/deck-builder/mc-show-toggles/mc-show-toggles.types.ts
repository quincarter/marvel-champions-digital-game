import type { ShowKey } from "../shared/deck-builder-events.types.js";

/** One Hero or Basic switch: on shows that kind of card in the pool. */
export interface ShowToggleModel {
  readonly id: "show-hero" | "show-basic";
  readonly key: ShowKey;
  readonly label: string;
  /** Shown (on): the chip reads with a tick. */
  readonly shown: boolean;
}

/** The Hero and Basic toggles (issue #977), and, inline, the pool's card count at the row's end. */
export interface ShowTogglesModel {
  readonly label: string;
  readonly toggles: readonly ShowToggleModel[];
  /** "128 cards": shown at the end of the row when `inline`. */
  readonly count: string;
}
