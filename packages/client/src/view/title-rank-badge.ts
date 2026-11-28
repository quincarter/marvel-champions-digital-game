/**
 * The Title's rank badge as plain data (docs/achievements.md, "Trophy shelf on the Title"): the rank, lifetime points
 * and the thin bar to the next rank, plus whether the Title should announce a rank-up. What the rank is, is
 * `progression/achievements.ts`'s; this only words it. Like the rest of progression it never touches a game.
 */
import { formatCount } from "./number-format.js";
import { rankProgressOf } from "../progression/achievements.js";
import { t } from "../i18n/translate.js";
import { rankTitleOf } from "./trophy-room-model.js";

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
  const grouped = (n: number): string => formatCount(n);
  const pointsLabel = t("title.rankPoints", { points: grouped(lifetimePoints) });
  const nextLabel = progress.next
    ? t("title.rankToNext", {
        points: grouped(progress.next.threshold - lifetimePoints),
        name: rankTitleOf(progress.next.rank),
      })
    : t("title.rankTop");
  const shortNextLabel = progress.next
    ? t("title.rankToRank", { points: grouped(progress.next.threshold - lifetimePoints), n: progress.next.rank })
    : t("title.rankTop");
  return {
    rankLabel: t("title.rank", { n: progress.rank.rank }),
    title: rankTitleOf(progress.rank.rank),
    pointsLabel,
    fraction: progress.fraction,
    nextLabel,
    shortNextLabel,
    summary: t("title.rankSummary", {
      n: progress.rank.rank,
      name: rankTitleOf(progress.rank.rank),
      points: pointsLabel,
      next: nextLabel,
    }),
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
    text: rank.rank > lastSeen ? t("title.rankUpNamed", { name: rankTitleOf(rank.rank) }) : "",
    remember: Math.max(lastSeen, rank.rank),
  };
}
