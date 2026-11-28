import type { ControlGlyph, TabRailTab } from "@mc/ui";

export interface McExtrasTabsProps {
  /** One tab per shelf: "Stories 3/10" (a phone: the short name). */
  tabs: readonly TabRailTab[];
  /** The chosen tab's id. */
  selected: string;
  /** The cells' label size in px (0 keeps the button's own). */
  size: number;
  /** LB / RB under the rail's right end while a pad is in use; none otherwise. */
  hint: ControlGlyph | undefined;
}
