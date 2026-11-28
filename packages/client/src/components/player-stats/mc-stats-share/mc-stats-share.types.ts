import type { StatsChipModel } from "../mc-stats-chip-row/mc-stats-chip-row.types.js";

/** What the Everyone tabs say about sharing. */
export type StatsShareInput =
  /** Sharing is off: "Share my games" and a line saying what is sent (and why the last try failed, when it did). */
  | { readonly kind: "offer"; readonly chip: StatsChipModel; readonly line: string }
  /** Sharing is on: "Sharing on". */
  | { readonly kind: "on"; readonly label: string };

export interface McStatsShareProps {
  input: StatsShareInput | null;
}
