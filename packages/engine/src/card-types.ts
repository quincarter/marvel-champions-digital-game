import type { AnyCard } from "@mc/content";

/** Every `type` the content schema gives a card. */
type SchemaCardType = AnyCard["type"];

/**
 * The card types of the game, by the schema's `type`, with the name a player reads: RRG 1.8 "Card Types" (p. 12),
 * "Ally, event, identity, player side scheme, resource, support, and upgrade cards are types of player cards.
 * Attachment, environment, main scheme, minion, obligation, side scheme, treachery, and villain cards are types of
 * encounter cards." Fifteen, written here in that order.
 *
 * Keyed by the whole schema union, so a type added to the schema does not compile until it is given a name here or
 * marked `null` (a schema `type` that is not a card type of the rules):
 * - `hero_identity` is the one "identity" type. Hero and alter-ego are forms of an identity card (RRG 1.8 "Form",
 *   p. 20), not card types, so they are not listed separately.
 * - `main_scheme` and `villain` are card types like any other, though neither can be in a hand or a deck.
 * - `evidence` (the Agents of S.H.I.E.L.D. campaign's evidence cards) is `null`: a campaign component the RRG's list
 *   does not name.
 */
const CARD_TYPE_NAMES: Readonly<Record<SchemaCardType, string | null>> = {
  ally: "Ally",
  event: "Event",
  hero_identity: "Identity",
  player_side_scheme: "Player side scheme",
  resource: "Resource",
  support: "Support",
  upgrade: "Upgrade",
  attachment: "Attachment",
  environment: "Environment",
  main_scheme: "Main scheme",
  minion: "Minion",
  obligation: "Obligation",
  side_scheme: "Side scheme",
  treachery: "Treachery",
  villain: "Villain",
  evidence: null,
};

/** A card type of the rules: the schema's types without those `CARD_TYPE_NAMES` marks `null`. */
export type RulesCardType = Exclude<SchemaCardType, "evidence">;

export const isRulesCardType = (type: string): type is RulesCardType =>
  (CARD_TYPE_NAMES as Readonly<Record<string, string | null>>)[type] != null;

/** The fifteen card types, player card types first, in the RRG's order. */
export const RULES_CARD_TYPES: readonly RulesCardType[] = Object.keys(CARD_TYPE_NAMES).filter(isRulesCardType);

/** "Event", "Player side scheme": the type's name as a prompt or a log line shows it. */
export const cardTypeName = (type: RulesCardType): string => CARD_TYPE_NAMES[type] ?? type;
