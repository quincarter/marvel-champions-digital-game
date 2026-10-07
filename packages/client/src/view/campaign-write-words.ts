/**
 * A few log writes the players know by what happened, not by the field written: the card a hero recorded, and the
 * genre sets checked off. One wording for the Dossier's Log and the Issue detail's list, so a write never reads one
 * way on one screen and another way on the next. Display only.
 */
import type { CardId } from "@mc/content";
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
  const named = (id: string): string => cardName(id as CardId);
  if (value.kind === "choice" && /^sideSchemeScenario\d+$/.test(field)) {
    return [{ headline: `Scheme: ${value.option}`, detail: "Its encounter card joins the deck." }];
  }
  // The strike list repeats the pick above (cumulative, so it would also repeat earlier picks).
  if (field === "sideSchemes" && value.kind === "strikeList") return [];
  if (field === "environmentsEarned" && value.kind === "cardList") {
    return [{ headline: `Earned: ${value.cardIds.map(named).join(", ")}`, detail: "In play every later scenario." }];
  }
  if (field === "encounterCards" && value.kind === "cardList") {
    return [
      { headline: `Added: ${value.cardIds.map(named).join(", ")}`, detail: "Shuffled into the deck from now on." },
    ];
  }
  if (field === "maraudersDefeated" && value.kind === "cardList") {
    return [
      { headline: `Marauders out: ${value.cardIds.map(named).join(", ")}`, detail: "Removed from the next scenario." },
    ];
  }
  if (field === "morlocksSaved" && value.kind === "number") {
    const plural = value.value === 1 ? "" : "s";
    return [{ headline: `${value.value} Morlock${plural} saved`, detail: "Each lets a player search next scenario." }];
  }
  if ((field === "hopeDamage3" || field === "hopeDamage4") && value.kind === "number") {
    return [{ headline: `Hope Summers: ${value.value} damage`, detail: "Placed on her, or as threat, next." }];
  }
  return null;
}
