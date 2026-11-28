import type { RulesScope } from "../shared/rules-events.types.js";

export interface McRulesScopeProps {
  /** "Filtered to what's on your table" and its kin. */
  caption: string;
  /** The two options; null with no game (nothing to scope against, only the caption). */
  toggle: {
    readonly scope: RulesScope;
    readonly allLabel: string;
    readonly tableLabel: string;
  } | null;
}
