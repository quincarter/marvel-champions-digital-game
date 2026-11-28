import type { LineListGroup } from "@mc/ui";

export interface McDeckListPanelProps {
  /** "YOUR DECK". */
  heading: string;
  /** The sort button's words ("Sort: Aspect"). */
  sortLabel: string;
  /** The deck's cards by group, with their copies. */
  groups: readonly LineListGroup[];
  /** "+ 4 more" when the list was cut; empty when it was not. */
  more: string;
}
