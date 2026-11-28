import type { CarryInRow } from "../../../view/campaign-side-scheme-model.js";
import type { KeyedPickCard } from "../mc-briefing-pick-card/mc-briefing-pick-card.types.js";

/** The row the answered side-scheme choice settled on. */
export interface SchemeChosenModel {
  /** "MISSION PREP → MISSION PREPPED", already capitalised. */
  readonly heading: string;
  /** A retry repeats the pick: "Same as last time" shows. */
  readonly repeated: boolean;
  readonly cards: readonly KeyedPickCard[];
}

/** What the answered side-scheme choice leaves on the Briefing (NeXt Evolution, MC40 p. 7). */
export interface SchemeSectionModel {
  readonly chosen: SchemeChosenModel | null;
  readonly carryIns: readonly CarryInRow[];
  /** The names of the encounter sets the issue fixes, joined; null for none. */
  readonly fixedSets: string | null;
  readonly phone: boolean;
}
