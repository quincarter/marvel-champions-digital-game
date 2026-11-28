/**
 * The pool section's words. The model (`view/campaign-pool-model.ts`) writes each group's title and caption and each row's
 * badge in English, one per destination kind, so they are said here in the player's language by that kind; a row's destination
 * line is the box's own story text and goes through `sectionTextIn`.
 */
import { t, tPlural } from "../../../i18n/translate.js";
import type { BriefingPoolRow, PoolDestinationKind } from "../../../view/campaign-pool-model.js";

export const poolHeadingIn = (cards: number | null): string =>
  cards === null ? t("briefing.pool.heading") : tPlural("briefing.pool.headingCount", cards);

export const poolGroupTitleIn = (kind: PoolDestinationKind): string => t(`briefing.pool.group.${kind}`);

export const poolGroupNoteIn = (kind: PoolDestinationKind): string => t(`briefing.pool.note.${kind}`);

/** ALLY / ENEMY for a card that becomes a game object; HELPS / AGAINST for one that rides in a deck. */
export function poolBadgeIn(row: Pick<BriefingPoolRow, "destinationKind" | "helps">): string {
  const real = row.destinationKind === "intoPlay" || row.destinationKind === "encounterDeck";
  if (real) return t(row.helps ? "briefing.pool.badge.ally" : "briefing.pool.badge.enemy");
  return t(row.helps ? "briefing.pool.badge.helps" : "briefing.pool.badge.against");
}
