import type { RulesCardSetModel } from "../mc-rules-card-set/mc-rules-card-set.types.js";

/** A section label ("IN THIS GAME") or an encounter set. */
export type RulesCardListItem =
  | { readonly kind: "label"; readonly text: string }
  | { readonly kind: "set"; readonly set: RulesCardSetModel };

export interface McRulesCardListProps {
  items: readonly RulesCardListItem[];
  /** What it says with nothing to list. */
  empty: string;
  /** The Card size setting's factor (1, 1.25, 1.5): bigger cards, fewer columns. */
  cardScale: number;
  /** The tile name strip's height in px (a desktop type size needs more). */
  caption: number;
}
