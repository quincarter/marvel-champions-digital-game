import type { SeatHeaderModel } from "../mc-briefing-seat-header/mc-briefing-seat-header.types.js";

/** What every call opens with: the line saying why Open waits, and the seat header of a per-seat call. */
export interface CallHeadModel {
  /** "Answer this to open issue #2.", or null. */
  readonly hint: string | null;
  readonly seat: SeatHeaderModel | null;
  readonly phone: boolean;
}
