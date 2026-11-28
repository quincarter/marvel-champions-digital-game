import type { RulesTile } from "../shared/rules-tile.js";

export type RulesEntryStatus = "stunned" | "confused" | "tough";

/** One glossary term, as the scene words it. */
export interface RulesEntryModel {
  readonly id: string;
  readonly name: string;
  readonly definition: string;
  /** The source(s), worded for a player ("RRG 1.8 p. 21"). */
  readonly cite: string;
  readonly note?: string;
  /** "Added with Mutant Genesis"; `boxId` is set (a link) only with no game running. */
  readonly origin?: { readonly text: string; readonly boxId: string | null };
  /** A status wears a stripe too (the term is always the plain word as well). */
  readonly status?: RulesEntryStatus;
  /** The cards that carry it, first six. */
  readonly tiles: readonly RulesTile[];
  /** How many more there are than `tiles`. */
  readonly more: number;
}

export interface McRulesEntryProps {
  entry: RulesEntryModel | null;
}
