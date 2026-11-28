import type { TrophyRow } from "../../../view/trophy-room-model.js";

export interface TrophyListModel {
  /** The list's rows in order: a heading per family, and under an open family its achievements (Mods: a heading per pack). */
  readonly rows: readonly TrophyRow[];
  /** A pack heading's words by group id ("From Silly pack"), already translated. */
  readonly groupLabels: Readonly<Record<string, string>>;
}

export interface McTrophyListProps {
  readonly model: TrophyListModel;
}

/** The stop each kind of row has: an achievement's by its id (it keeps it however the list folds or sorts), a family's heading, a pack's label (none). */
export const trophyKeyOf = (row: TrophyRow): string =>
  row.kind === "section" ? `sec:${row.id}` : row.kind === "group" ? `grp:${row.id}` : `row:${row.id}`;
