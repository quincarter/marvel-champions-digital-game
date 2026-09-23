/**
 * C11 Finale: the three stat boxes and the CTA a won campaign ends on (docs/campaign-mode-design.md §10.2).
 *
 * Every number is read from the record itself, never invented: `issues` from the definition's own node count and
 * how many of them the log marks completed, `rewinds` from counting lost attempts in `record.history`, and
 * `alliesFreed` from summing whatever `CollectionFilter`-free `cardList` field the box's own story names for "an
 * ally the players kept" — MC10's `rescuedAllies` (MC10 p. 10). A campaign with no such field (or none playable
 * yet, since only MC10 ships) reads 0 rather than guessing.
 */
import type { CampaignDefinition } from "@mc/engine";
import type { CampaignRecord } from "../engine/campaign-storage.js";

export interface FinaleStats {
  readonly issuesCompleted: number;
  readonly issuesTotal: number;
  readonly rewinds: number;
  readonly alliesFreed: number;
}

export interface FinaleView {
  readonly stats: FinaleStats;
  /** Whether this run's own record is already an expert-campaign run — the CTA reads "back to the saga" then. */
  readonly alreadyExpert: boolean;
}

/**
 * `alliesField` is the per-seat `cardList` log field this box's rulebook uses for "allies rescued/freed and kept"
 * — MC10's `rescuedAllies` (MC10 p. 10). Absent (a box with no such field, or none named) reads 0, honestly.
 */
export function finaleViewOf(
  definition: CampaignDefinition,
  record: CampaignRecord,
  alliesField: string | null = "rescuedAllies",
): FinaleView {
  const issuesTotal = definition.graph.nodes.length;
  const issuesCompleted = Object.values(record.position.resolved).filter((mark) => mark === "completed").length;
  const rewinds = record.history.filter((entry) => entry.outcome === "lost").length;
  let alliesFreed = 0;
  if (alliesField) {
    for (const seat of record.seats) {
      const value = seat.fields[alliesField];
      if (value?.kind === "cardList") alliesFreed += value.cardIds.length;
    }
  }
  return {
    stats: { issuesCompleted, issuesTotal, rewinds, alliesFreed },
    alreadyExpert: alreadyExpertOf(record),
  };
}

/** Whether the finished run was already the Expert Campaign (`CampaignModeRef.expertCampaign`). */
function alreadyExpertOf(record: CampaignRecord): boolean {
  return record.modes.campaign?.expertCampaign === true;
}

/** One hero line per seat, in seat order; a roster longer than the written lines reuses the last one (design's own rule). */
export function finaleHeroLineFor(heroLines: readonly string[], seatIndex: number): string {
  return heroLines[Math.min(seatIndex, heroLines.length - 1)] ?? "";
}
