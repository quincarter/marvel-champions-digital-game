/**
 * A few log writes the players know by what happened, not by the field written: the card a hero recorded, and the
 * genre sets checked off. One wording for the Dossier's Log and the Issue detail's list, so a write never reads one
 * way on one screen and another way on the next. Display only.
 */
import type { LogValue } from "@mc/engine";
import type { CardNameOf } from "./campaign-log-model.js";

export interface PlainWriteRow {
  readonly headline: string;
  readonly detail: string;
}

/** "sci-fi" -> "Sci-Fi", "crime" -> "Crime": a checked-off set as the players name it. */
const setWords = (id: string): string =>
  id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");

/**
 * The plain rows for one write, or null when the field has no plain wording (the caller's own row stands).
 * `hero` is the seat's hero name, or null for a shared write.
 */
export function plainWriteRows(
  field: string,
  value: LogValue,
  hero: string | null,
  cardName: CardNameOf,
): readonly PlainWriteRow[] | null {
  if (field === "recordedCards" && value.kind === "cardList" && hero) {
    // One row per recorded card: "Gambit recorded Gambit's Guild Armor".
    return value.cardIds.map((id) => ({
      headline: `${hero} recorded ${cardName(id)}`,
      detail: "Can be put into play from any deck next issue.",
    }));
  }
  if (field === "modularSets" && value.kind === "strikeList") {
    return [
      {
        headline: `Checked off: ${value.struck.map(setWords).join(", ")}`,
        detail: "Not picked again while others remain.",
      },
    ];
  }
  return null;
}
