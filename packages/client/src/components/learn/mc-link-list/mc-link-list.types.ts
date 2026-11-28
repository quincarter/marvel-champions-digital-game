import type { LearnEventDetail } from "../shared/learn-events.types.js";

/** One row of a link list, already translated. */
export interface LinkListRow {
  /** The row's focus stop key (`reference`, `box:<id>`). */
  readonly stop: string;
  readonly heading: string;
  readonly detail: string;
  /** What a press raises as `mc-learn`. */
  readonly action: LearnEventDetail;
}

/** The properties of `mc-link-list`. */
export interface LinkListProps {
  readonly heading: string;
  readonly rows: readonly LinkListRow[];
  /** How many equal columns the rows fill (1 or 2). */
  readonly columns: number;
}
