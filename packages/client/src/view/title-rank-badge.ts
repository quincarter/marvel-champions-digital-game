/**
 * The Title's rank badge as plain data (docs/achievements.md, "Trophy shelf on the Title"): the rank, lifetime points
 * and the thin bar to the next rank, plus whether the Title should announce a rank-up. What the rank is, is
 * `progression/achievements.ts`'s; this only words it. Like the rest of progression it never touches a game.
 */
import { rankProgressOf } from "../progression/achievements.js";

export interface TitleRankBadge {
  /** "RANK 3" */
  readonly rankLabel: string;
  /** "Costumed Vigilante" */
  readonly title: string;
  /** "1,250 pts" */
  readonly pointsLabel: string;
  /** 0 to 1 toward the next rank; 1 at the top. */
  readonly fraction: number;
  /** "300 to Street-Level Legend" or "Top rank": the bar's caption, so it is never color or length alone. */
  readonly nextLabel: string;
  /** "300 to rank 4" or "Top rank": the caption where the plate is too narrow for the next rank's name. */
  readonly shortNextLabel: string;
  /** One sentence for the focus ring and assistive text. */
  readonly summary: string;
}

export function titleRankBadgeOf(lifetimePoints: number): TitleRankBadge {
  const progress = rankProgressOf(lifetimePoints);
  const pointsLabel = `${lifetimePoints.toLocaleString("en-US")} pts`;
  const nextLabel = progress.next
    ? `${(progress.next.threshold - lifetimePoints).toLocaleString("en-US")} to ${progress.next.title}`
    : "Top rank";
  const shortNextLabel = progress.next
    ? `${(progress.next.threshold - lifetimePoints).toLocaleString("en-US")} to rank ${progress.next.rank}`
    : "Top rank";
  return {
    rankLabel: `RANK ${progress.rank.rank}`,
    title: progress.rank.title,
    pointsLabel,
    fraction: progress.fraction,
    nextLabel,
    shortNextLabel,
    summary: `Rank ${progress.rank.rank} of 9, ${progress.rank.title}, ${pointsLabel}. ${nextLabel}. Opens the Trophy Room.`,
  };
}

export interface RankUpAnnouncement {
  /** True only when the rank is higher than the last one the Title showed. */
  readonly announce: boolean;
  /** "Rank up: Costumed Vigilante", or empty when there is nothing to announce. */
  readonly text: string;
  /** The rank number to remember as seen after this visit (never lowered). */
  readonly remember: number;
}

/**
 * Whether this Title visit should announce a rank-up. `lastSeen` is the rank the previous visit stored, or null when
 * none was (first launch, or storage unreadable): that visit only records, so an existing player is not told they
 * "ranked up" just because this feature arrived. The stored rank never goes down, so a rank that drops (the history
 * was cleared) is not announced again when it is regained.
 */
export function rankUpAnnouncementOf(lastSeen: number | null, lifetimePoints: number): RankUpAnnouncement {
  const { rank } = rankProgressOf(lifetimePoints);
  if (lastSeen === null) return { announce: false, text: "", remember: rank.rank };
  return {
    announce: rank.rank > lastSeen,
    text: rank.rank > lastSeen ? `Rank up: ${rank.title}` : "",
    remember: Math.max(lastSeen, rank.rank),
  };
}
