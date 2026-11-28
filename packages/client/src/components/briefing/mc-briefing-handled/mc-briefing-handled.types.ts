import type { HandledRow } from "../../../view/campaign-briefing-model.js";

/**
 * What "Handled for you" shows: the rows setup produced, or (`waiting`) the line an unfilled panel says while the issue waits on
 * a call or is still composing. `waiting` wins when it is not null.
 */
export interface HandledModel {
  readonly rows: readonly HandledRow[];
  readonly waiting: string | null;
}
