/**
 * Seat labels for Civil War Competitive rooms (issue #883). An ordinary or Epic room's seat takes its hero from the
 * deck its player picks (`room-table-setup.ts`), so its label is cosmetic; a Competitive room's host picks each seat's
 * hero, and the lobby keeps it as opaque text in the seat's `label`: the hero and deck words, with the identity card id
 * after a separator for the seat's picture on every device.
 */
import type { LobbySeatSpec } from "../live/room-state.js";
import type { DeckOption } from "./deck-list-model.js";

/** The longest seat label the room takes. */
export const SEAT_LABEL_MAX = 80;

/** The room keeps a seat's label as opaque text; the hero's identity card id rides after this separator. */
const CARD_SEPARATOR = "|";

/** A label with its identity card id after it, within the room's cap (`fallback` when the words are empty). */
export function labelWithCard(label: string, cardId: string | null, fallback: string): string {
  const tail = cardId ? CARD_SEPARATOR + cardId : "";
  const text = label.trim().slice(0, Math.max(1, SEAT_LABEL_MAX - tail.length)) || fallback;
  return text + tail;
}

/** One seat spec for seat `id` carrying a hero's label and identity card. */
export const seatSpecWithHero = (id: string, label: string, cardId: string | null): LobbySeatSpec => ({
  id,
  label: labelWithCard(label, cardId, id),
});

/** A seat label from the room, split into its words and its identity card id (none when it carries none). */
export function parseSeatLabel(label: string): { readonly text: string; readonly cardId: string | null } {
  const at = label.lastIndexOf(CARD_SEPARATOR);
  if (at < 0) return { text: label, cardId: null };
  const cardId = label.slice(at + 1).trim();
  return { text: label.slice(0, at), cardId: cardId === "" ? null : cardId };
}

/**
 * A seat's label: the hero and the deck, or the deck alone when its name already says the hero ("Spider-Man (Justice) -
 * Core Set starter deck" names Spider-Man), so a label never says the hero twice.
 */
export function seatLabelOf(hero: string | null, deck: string | null): string {
  const heroShort = hero?.replace(/\s*\(.*\)\s*$/, "").trim() ?? "";
  if (deck && heroShort !== "" && deck.toLowerCase().includes(heroShort.toLowerCase())) return deck.trim();
  return [hero, deck].filter((part): part is string => !!part && part.trim() !== "").join(" - ");
}

/** A seat whose hero the host has not chosen yet: the room keeps labels as opaque text. */
export const HERO_UNSET = "?";

/** The deck option that can play the hero a seat's label names (by identity card id), preferring the deck the label names. */
export function deckForSeat(label: string, decks: readonly DeckOption[]): DeckOption | null {
  const { text, cardId } = parseSeatLabel(label);
  if (cardId === null) return null;
  const same = decks.filter((o) => o.seatable && (o.deck.identityCardId as string) === cardId);
  if (same.length === 0) return null;
  const wanted = text.toLowerCase();
  return same.find((o) => wanted.includes(o.deck.name.toLowerCase())) ?? same[0] ?? null;
}

/** The hero names (from the seat labels) that none of `decks` can play. */
export function missingHeroes(labels: readonly string[], decks: readonly DeckOption[]): readonly string[] {
  return labels
    .filter((label) => label !== HERO_UNSET && deckForSeat(label, decks) === null)
    .map((label) => parseSeatLabel(label).text.split(" - ")[0] ?? label);
}
