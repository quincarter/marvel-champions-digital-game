/**
 * What the moved page says this browser holds, from the same summary the game's import confirm reads
 * (`save-data/save-file.ts`'s `saveFileSummaryOf`), in the page's language.
 */
import type { SaveFileSummary } from "../../save-data/save-file.js";
import type { Translate } from "../site-dom.js";

/** Whether the summary has anything worth carrying across. Settings alone count: a player's options are theirs too. */
export function hasSaves(summary: SaveFileSummary): boolean {
  return summary.games + summary.decks + summary.campaigns > 0 || summary.unlocks || summary.settings;
}

/** "3 saved games, 1 deck and settings". */
export function describeSaved(summary: SaveFileSummary, t: Translate): string {
  const count = (n: number, one: string, many: string): string | null =>
    n === 0 ? null : n === 1 ? t(one) : t(many, { n });
  const parts = [
    count(summary.games, "count.game", "count.games"),
    count(summary.decks, "count.deck", "count.decks"),
    count(summary.campaigns, "count.campaign", "count.campaigns"),
    summary.unlocks ? t("count.unlocks") : null,
    summary.settings ? t("count.settings") : null,
  ].filter((part): part is string => part !== null);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} ${t("count.and")} ${parts.at(-1)!}`;
}
