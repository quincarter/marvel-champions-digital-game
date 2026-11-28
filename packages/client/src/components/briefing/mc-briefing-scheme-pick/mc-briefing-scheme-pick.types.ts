import type { KeyedPickCard } from "../mc-briefing-pick-card/mc-briefing-pick-card.types.js";

/** One offered side scheme: its name (the option id), the row heading and its cards. */
export interface SchemePickRow {
  /** The option id the row answers with. */
  readonly name: string;
  /** "Mission Prep → Mission Prepped" as the row names it. */
  readonly label: string;
  /** Each card has its `key` ("scheme", "environment", "encounter") for the stop key. */
  readonly cards: readonly KeyedPickCard[];
}

/** The player-side-scheme call (NeXt Evolution, MC40 p. 7). */
export interface SchemePickModel {
  readonly rows: readonly SchemePickRow[];
}
