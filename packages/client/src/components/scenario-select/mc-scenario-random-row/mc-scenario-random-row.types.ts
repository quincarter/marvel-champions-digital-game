/** The row above the list: its Random buttons, and, drilled into a box, "All packs" and the box's name. */
export interface ScenarioRandomRowModel {
  /** "◂ All packs" (a box is open: it leads the row); null on the full shelf list. */
  readonly drillBack: string | null;
  /** The open box's name, already in capitals' source case; empty on the full shelf list. */
  readonly title: string;
  /** The Random buttons, in order: each is a stop and a press under its `id` (`random-box`, `random-scenario`, `random-villain`). */
  readonly buttons: readonly { readonly id: string; readonly label: string }[];
}
