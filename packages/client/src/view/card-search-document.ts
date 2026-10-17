/**
 * A player card as a search document for the search worker (`view/deck-search.ts`): its name first, then its traits,
 * type, aspect and pack, then its rules text as the weakest field. The deck builder's and Decks' card searches use it,
 * so a card is found the same way on both screens.
 */
import type { AnyCard } from "@mc/content";
import type { SearchDocument } from "./deck-search.js";

/** A card's current rules text as plain words: "[thwart]" reads "thwart", "S.H.I.E.L.D._Agent" reads "S.H.I.E.L.D. Agent". */
export function plainRulesTextOf(card: AnyCard): string {
  if (!("text" in card) || !card.text) return "";
  const text = card.text as unknown;
  const current = typeof text === "string" ? text : ((text as { readonly current?: string }).current ?? "");
  return current.replace(/[[\]]/g, " ").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function cardSearchDocumentOf(card: AnyCard, packName?: string): SearchDocument {
  const subname = "subname" in card && typeof card.subname === "string" ? card.subname : null;
  const traits = "traits" in card ? (card.traits as readonly string[]) : [];
  const aspect = "aspect" in card && typeof card.aspect === "string" ? card.aspect : null;
  const rules = plainRulesTextOf(card);
  return {
    id: card.id as string,
    primary: [card.name, ...(subname ? [subname] : [])],
    secondary: [...traits, card.type.replace(/_/g, " "), ...(aspect ? [aspect] : []), ...(packName ? [packName] : [])],
    notes: rules ? [rules] : [],
  };
}
