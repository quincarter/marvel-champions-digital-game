import type { HintGlyph, TabRailTab } from "@mc/ui";
import type { McRulesCardListProps } from "../../../components/rules/mc-rules-card-list/mc-rules-card-list.types.js";
import type { RulesEntryModel } from "../../../components/rules/mc-rules-entry/mc-rules-entry.types.js";
import type { RulesStepModel } from "../../../components/rules/mc-rules-step/mc-rules-step.types.js";
import type { McRulesScopeProps } from "../../../components/rules/mc-rules-scope/mc-rules-scope.types.js";

export type RulesTabId = "glossary" | "villainPhase" | "cardList";

/** Everything the Rules reference shows; the scene builds it from the game, the pool and the search and sets it on the page. */
export interface RulesPageModel {
  readonly header: {
    readonly backLabel: string;
    readonly heading: string;
    readonly backGlyph: HintGlyph | null;
    readonly titleDrop: number;
    readonly titleMax: number;
    /** The scope row's words, and its toggle (only with a game running). */
    readonly caption: string;
    readonly toggle: McRulesScopeProps["toggle"];
  };
  readonly tabs: readonly TabRailTab[];
  readonly tab: RulesTabId;
  /** The glossary's search field; null on the other tabs. */
  readonly search: { readonly query: string; readonly placeholder: string } | null;
  readonly glossary: { readonly entries: readonly RulesEntryModel[]; readonly empty: string } | null;
  readonly villain: { readonly steps: readonly RulesStepModel[]; readonly citation: string } | null;
  readonly cards: Pick<McRulesCardListProps, "items" | "empty" | "cardScale" | "caption"> | null;
}
