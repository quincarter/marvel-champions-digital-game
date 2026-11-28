import type { RulesEntryModel } from "../mc-rules-entry/mc-rules-entry.types.js";

export interface McRulesGlossaryProps {
  entries: readonly RulesEntryModel[];
  /** What it says when the search matches nothing. */
  empty: string;
}
