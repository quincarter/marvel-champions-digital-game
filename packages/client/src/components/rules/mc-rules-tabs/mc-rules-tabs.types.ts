import type { TabRailTab } from "@mc/ui";

export interface McRulesTabsProps {
  /** The three tabs, in order, already translated. */
  tabs: readonly TabRailTab[];
  /** The chosen tab's id. */
  selected: string;
}
