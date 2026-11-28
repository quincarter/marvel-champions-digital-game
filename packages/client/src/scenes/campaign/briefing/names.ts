/**
 * The Briefing's name lookups, shared by the shell and the call and section pieces: a card's name by id, a seat's hero as
 * the table names it, a pool card by its printed name and the encounter sets' names.
 */
import type { AnyCard, CardId } from "@mc/content";
import { campaignCardsById } from "../../../content/campaign-pool.js";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS } from "../../../content/pool.js";
import { heroFaceDisplayName } from "../../../view/hero-names.js";

export const cardNameOf = (id: string): string => campaignCardsById().get(id)?.name ?? id;

/** A seat's hero as the table names it ("Colossus"; "Spider-Man (Peter Parker)" where a name is shared). */
export const heroNameOf = (id: CardId): string => {
  const card = campaignCardsById().get(id);
  return card?.type === "hero_identity" ? heroFaceDisplayName(card) : cardNameOf(id);
};

/** A pool field names a card by name, never an id (see `scenes/campaign/dossier.ts`'s own copy of this). */
const CARD_BY_NAME = new Map<string, AnyCard>([...CARDS_BY_ID.values()].map((card) => [card.name, card] as const));
export const cardOfName = (name: string): AnyCard | undefined => CARD_BY_NAME.get(name);
export const cardTypeOf = (name: string): { readonly type: string } | undefined => {
  const card = cardOfName(name);
  return card ? { type: card.type } : undefined;
};

export const ENCOUNTER_SET_NAMES = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name] as const));
export const KNOWN_ENCOUNTER_SET_IDS: ReadonlySet<string> = new Set(ENCOUNTER_SET_NAMES.keys());
