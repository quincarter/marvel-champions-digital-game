/**
 * "From the pool": what it is handed (the composed issue's `BriefingPoolView`) and what it reports (a pool card's picture
 * pressed or held to read it, the shared `SectionEvents`).
 */
import type { BriefingPoolGroup, BriefingPoolRow, BriefingPoolView } from "../../../../../view/campaign-pool-model.js";
import type { SectionBase, SectionEvents } from "../sections.types.js";

export interface PoolInput extends SectionBase {
  readonly pool: BriefingPoolView;
}

export type PoolEvents = SectionEvents;

/** A group's own draw: the groups of the finale, laid out for a phone (stacked) or a wide column (a grid). */
export interface PoolGroupsInput extends SectionBase {
  readonly groups: readonly BriefingPoolGroup[];
}

/** One row's draw (a flat row of the pool list). */
export interface PoolRowInput extends SectionBase {
  readonly row: BriefingPoolRow;
}
