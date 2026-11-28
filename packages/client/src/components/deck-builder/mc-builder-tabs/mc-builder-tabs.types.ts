import type { ControlGlyph } from "@mc/ui";

/** One tab: "Pool", "Deck 15/40", "From your games"; or the wide rail's "Your deck" and "From your games". */
export interface BuilderTabModel {
  readonly id: string;
  readonly label: string;
}

/**
 * A strip of tabs. `prefix` says which: `tab:` (the narrow layout's Pool, Deck and From your games) or `rail:` (the wide
 * deck rail's two). `glyph` is the LB / RB hint hung over the strip while a keyboard or pad is in use.
 */
export interface BuilderTabsModel {
  readonly prefix: "tab:" | "rail:";
  readonly selected: string;
  readonly tabs: readonly BuilderTabModel[];
  readonly glyph?: ControlGlyph | undefined;
}
