import type { TabRailTab } from "@mc/ui";

export interface McModTabsProps {
  /** The tabs, in order, already translated; their ids are the scene's (`all`, `heroes`, ...). */
  tabs: readonly TabRailTab[];
  /** The chosen tab's id. */
  selected: string;
  /** The magnifier's accessible name ("Search and filters"). */
  toggleLabel: string;
  /** A phone shows the magnifier; wider screens show the search box always. */
  toggleShown: boolean;
  /** The finders are showing (or a search narrows the list): the magnifier is on. */
  toggleOpen: boolean;
}
