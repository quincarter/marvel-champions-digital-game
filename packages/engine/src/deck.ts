/**
 * Deck legality ("is this a legal deck by the rules?") and playability ("can this build play
 * it?"). These are separate questions with separate functions.
 *
 * Source: Marvel Champions Rules Reference, version 1.8 (Jul 2026; FFG PDF
 * `mc_rulesreference_v18_compressed.pdf`), Appendix I "Deck Customization", p. 50:
 *
 *   "• A player must choose exactly one identity card.
 *    • A player's deck consists of a minimum of 40 cards and a maximum of 50 cards. The
 *      identity card and any cards with the permanent keyword are not counted as part of
 *      this number.
 *    • A player's deck must include each of the identity-specific cards associated with their
 *      chosen identity card. The exact quantity of each card included in that identity set
 *      must be included in the deck.
 *        [sub-bullet: the Team-Up replacement at setup; see the note on `validateDeck`]
 *    • A player may choose exactly one aspect (Justice, Aggression, Protection, or Leadership)
 *      to use for customization. The remainder of their deck is then customized with cards
 *      that belong to that aspect and/or basic cards.
 *    • No more than three copies (by title) of each non-unique card may be included in the deck.
 *    • A player deck cannot include multiple cards that are considered to 'match' under the
 *      rules for uniqueness (see Unique Icon). The identity is included in this evaluation.
 *    • Any 'deckbuilding requirements' on the player's identity card must be followed."
 *
 * The glossary entries this module also relies on are cited at each check. Community deck
 * rules (MarvelCDB's builder, Hall of Heroes) were not used as a source.
 */

import type {
  AbilityReference,
  AnyCard,
  CardId,
  CoreAspect,
  DeckCardEntry,
  DeckContents,
  HeroIdentityCard,
  IdentitySeparateDeck,
  PlayerCard,
} from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { CampaignCardFace } from "./campaign.js";
import { cardsMatch, isUnique, uniqueLabel } from "./unique.js";

/**
 * The first separate deck this identity brings that the engine cannot build yet, or undefined (docs/phase7-wave2.md
 * §15). Only Doctor Strange's kind is built: a deck of player cards with its own discard pile. Hercules's Labor deck
 * (encounter-backed cards) and Gift deck (no discard pile) are data only.
 */
export function unbuildableSeparateDeck(identity: HeroIdentityCard): IdentitySeparateDeck | undefined {
  return (identity.separateDecks ?? []).find(
    (deck) => (deck.cardFamily ?? "player") !== "player" || deck.discardPile !== "own",
  );
}

export type DeckProblemCode =
  /** A decklist line whose quantity is not a whole number of at least 1. */
  | "invalid_quantity"
  /** The same card code listed on two lines. */
  | "duplicate_entry"
  /** A card code (identity or deck card) that is not in the card pool at all. */
  | "unknown_card"
  /** The chosen identity is a real card but not a hero identity. */
  | "not_an_identity"
  /** An identity card in the card list. The identity is chosen separately and is never part of the list. */
  | "identity_in_deck"
  /** An encounter-side card (minion, treachery, obligation, nemesis card, villain, scheme). */
  | "not_a_player_card"
  /** RRG "Linked (Card Title)": cannot be included in any deck. */
  | "linked_card"
  /**
   * RRG 1.8 "Deck": a card of a separate deck an identity brings to the game (Doctor Strange's Invocation deck).
   * It is built at setup from the identity, so it is never listed and never counted toward deck size.
   */
  | "separate_deck_card"
  /**
   * RRG 1.8 "Campaign-Specific Card" (p. 11): "Campaign-specific cards can only be used during a campaign from the
   * same product (determined by that product's set icon)." Raised when the deck is not being built for a campaign at
   * all, or is being built for a campaign the card's set does not belong to.
   */
  | "campaign_card"
  /**
   * A campaign card of *this* campaign that the campaign has not given this player. The Rise of Red Skull rulebook
   * (p. 3), "Campaign-Only Cards": "These cards cannot be included in any player's deck unless they are playing The
   * Rise of Red Skull campaign **and the players were directed to add them to their decks**."
   */
  | "campaign_card_not_granted"
  /** RRG 1.8 Appendix I / MC10 p. 3: "Each player must use their chosen identity for the entire campaign." */
  | "campaign_identity_locked"
  /**
   * RRG 1.8 "Campaign" (p. 29): "If a card is removed from a campaign, that card can no longer be used during the
   * rest of the campaign, even if players retry the scenario wherein that card was removed."
   */
  | "campaign_removed_card"
  /** A card or modular set the box forbids *inside* its own campaign (MC27 p. 4; MC40 p. 6). */
  | "campaign_prohibited_card"
  /** Deck customization is frozen for the rest of the campaign (MC16 p. 5 mandatory; MC27 p. 6 optional). */
  | "campaign_deck_frozen"
  /**
   * A scenario-specific player card (RRG 1.8 "Scenario-Specific Card", p. 38): it belongs to a scenario's set and
   * enters the game through that scenario (Taskmaster's Captive allies), never through deckbuilding.
   */
  | "scenario_card"
  /**
   * A card used only in competitive (team-vs-team) mode: each Civil War leader's four basic player cards. The Civil War
   * rulebook (p. 3): "These leader-specific player cards are used only when playing in competitive mode." That mode is
   * not built (docs/phase7-wave2.md §6.3).
   */
  | "competitive_card"
  /**
   * The identity uses a rule this build does not model, so it cannot be seated: a separated identity split across two
   * cards (SP//dr; `HeroIdentityCard.separatedIdentity`, docs/phase7-wave2.md §6.10), or a separate deck of a kind
   * the engine cannot build (Hercules's Labor and Gift decks; `unbuildableSeparateDeck`, §15).
   */
  | "unsupported_identity"
  /** The card data lacks a field legality needs, so the rule cannot be checked. Never guessed. */
  | "missing_card_data"
  /** A deckbuilding classification this build does not recognize (for example campaign-specific). */
  | "unrecognized_classification"
  /** The deck's chosen aspect(s) are not a legal choice for its identity. */
  | "aspect_choice"
  | "deck_size"
  /** An aspect card from an aspect the deck did not choose. */
  | "aspect_restriction"
  /** An identity-specific card belonging to a different identity. */
  | "other_identity_card"
  /** A signature (identity set) card missing, or present in a different quantity than the set has. */
  | "identity_set_mismatch"
  /** More copies of a title than the three-copy rule or a printed "Max X per deck" allows. */
  | "copy_limit"
  /** The deckbuilding half of the unique rule: two matching unique cards, the identity included. */
  | "unique_match"
  /** RRG "Team-Up": the identity is neither named character. */
  | "team_up_identity"
  /** A deckbuilding requirement printed on the identity (modeled as data) is not met. */
  | "deckbuilding_requirement"
  /** The identity has a deckbuilding requirement this build cannot check yet. */
  | "unsupported_deckbuilding_requirement";

export interface DeckProblem {
  readonly code: DeckProblemCode;
  /** Player-readable, meant to be shown verbatim by the builder and import screens. */
  readonly message: string;
  /** The offending card(s), as listed or chosen. Empty for a whole-deck problem such as deck size. */
  readonly cardIds: readonly CardId[];
}

export type DeckValidation = { readonly ok: true } | { readonly ok: false; readonly problems: readonly DeckProblem[] };

/**
 * Where this deck is being built, when that changes what is legal (docs/campaign-mode-design.md §8).
 *
 * Absent — which is every caller that predates campaign mode — means "a standalone deck", and `validateDeck`
 * behaves and words itself exactly as it always has. An interface rather than the campaign context directly,
 * because competitive (team-vs-team) mode will want the same treatment for `competitive_card`.
 */
export interface DeckContext {
  readonly campaign?: CampaignDeckContext;
}

/**
 * The campaign a deck is being built for. Supplied by the caller out of the `CampaignLog` and the `@mc/content`
 * `Campaign` record, because the engine holds neither and never names a box.
 */
export interface CampaignDeckContext {
  /** Opaque here; carried so a message can name the campaign the deck belongs to. */
  readonly campaignId: string;
  /**
   * The encounter sets whose cards are campaign-specific to *this* campaign — `Campaign.campaignSetIds` plus
   * `perSeatSetIds`. RRG 1.8 p. 11's "from the same product" is checked as membership of this list, because the
   * set icon is what the rule actually points at.
   */
  readonly campaignSetIds: readonly string[];
  /** MC10 p. 3: the identity is locked for the whole campaign. */
  readonly identityCardId: string;
  /**
   * One entry per granted **copy** (`CampaignSeat.grants`), so two copies of one title are two entries. Granted
   * cards are legal here and are exempt from minimum and maximum deck size (MC10 p. 3: "Cards added to the deck as
   * part of a campaign do not count toward a player's minimum or maximum deck size").
   */
  readonly grantedCardIds: readonly string[];
  /**
   * RRG 1.8 p. 29 removals, **by face**: ruling April 30, 2026 (4) answer 2 keeps the other face of a
   * double-sided card available. A deck lists a card by its front face, so only a removal with no `face` refuses it.
   */
  readonly removedFromCampaign?: readonly CampaignCardFace[];
  /** Player cards the box forbids inside its own campaign (MC27 p. 4). */
  readonly prohibitedCardIds?: readonly string[];
  /** Sets the box forbids inside its own campaign (MC40 p. 6); a card of one of them is refused. */
  readonly prohibitedEncounterSetIds?: readonly string[];
  /**
   * The non-granted lines the deck is frozen to. MC16 p. 5: "players may not change their decks for the rest of the
   * campaign"; MC27 p. 6 makes the same freeze optional. Absent means customization is still open.
   */
  readonly frozenNonCampaignCards?: readonly DeckCardEntry[];
}

/**
 * **Undecided rule — decision point (docs/campaign-mode-design.md Q8).**
 *
 * MC27 p. 22's Aspect Advantage adds "the maximum number of copies of that card, by title" and says those copies do
 * not count toward deck size, but says nothing about the three-copy limit when the deck already holds copies of that
 * title. RRG 1.8 Appendix I (p. 50) is silent, and no ruling covers it.
 *
 * `false` — the design's recommendation, implemented here — excludes granted copies from the by-title count, which
 * is the reading consistent with their deck-size exemption. Flip this one constant to `true` to make grants count.
 * **Not exercised by the first box** (The Rise of Red Skull grants only campaign-specific cards, which never reach
 * the copy-limit check at all); it must be decided before the box that has Aspect Advantage is built.
 */
export const CAMPAIGN_GRANTS_COUNT_TOWARD_COPY_LIMIT = false;

/** Either the card list the engine is configured with or a card pool keyed by id (as in `GameState.cardPool`). */
export type CardPool = readonly AnyCard[] | Readonly<Record<string, AnyCard>>;

/** RRG 1.8 Appendix I: "a minimum of 40 cards and a maximum of 50 cards". */
export const DECK_MIN_CARDS = 40;
export const DECK_MAX_CARDS = 50;
/** RRG 1.8 Appendix I: "No more than three copies (by title) of each non-unique card". */
export const DECK_COPY_LIMIT = 3;

/**
 * The aspects a deck may choose. RRG 1.8 disagrees with itself here: Appendix I (p. 50)
 * lists four ("Justice, Aggression, Protection, or Leadership"), but the more specific
 * glossary entries list five. "Aspect Card" (p. 8) says "a player must choose one of the five
 * aspects (Aggression, Justice, Leadership, Protection, or 'Pool)", and "Classifications"
 * (p. 11) agrees. The FAQ "Crisis of Infinite Deadpools (#37)" (p. 62) also treats 'Pool as
 * a choosable aspect ("chooses the 'Pool aspect as (one of) their chosen aspect(s)").
 * Five is implemented, and the discrepancy is flagged for FFG.
 */
export const CHOOSABLE_ASPECTS: readonly CoreAspect[] = ["aggression", "justice", "leadership", "protection", "pool"];

const ASPECT_NAMES: Readonly<Record<CoreAspect, string>> = {
  aggression: "Aggression",
  justice: "Justice",
  leadership: "Leadership",
  protection: "Protection",
  pool: "'Pool",
  basic: "Basic",
};

const aspectName = (aspect: string): string => ASPECT_NAMES[aspect as CoreAspect] ?? `"${aspect}"`;

/** RRG 1.8 "Player Deck" (p. 33): allies, events, player side schemes, resources, supports, and upgrades. */
const PLAYER_DECK_TYPES: ReadonlySet<AnyCard["type"]> = new Set<AnyCard["type"]>([
  "ally",
  "event",
  "support",
  "upgrade",
  "resource",
  "player_side_scheme",
]);

const isPlayerDeckCard = (card: AnyCard): card is PlayerCard => PLAYER_DECK_TYPES.has(card.type);

const isCardList = (pool: CardPool): pool is readonly AnyCard[] => Array.isArray(pool);

const indexPool = (pool: CardPool): ReadonlyMap<string, AnyCard> =>
  isCardList(pool) ? new Map(pool.map((card) => [card.id as string, card])) : new Map(Object.entries(pool));

const copies = (n: number): string => (n === 1 ? "1 copy" : `${n} copies`);

const typeName = (card: AnyCard): string => card.type.replace(/_/g, " ");

const hasPlainKeyword = (card: PlayerCard, name: "permanent"): boolean => card.keywords.some((k) => k.name === name);

type TeamUp = { readonly names?: readonly [string, string] };
const teamUpOf = (card: PlayerCard): TeamUp | undefined =>
  card.keywords.find((k) => k.name === "teamUp") as TeamUp | undefined;
const isLinked = (card: PlayerCard): boolean => card.keywords.some((k) => k.name === "linked");

/**
 * Cards carrying the identity's set icon (`aspect: "hero:<identity id>"`, RRG 1.8
 * "Identity-Specific Card", p. 23) that are part of its set for deckbuilding. A linked card is
 * left out: it is part of the set but "cannot be included in any deck" ("Linked", p. 27; ruling
 * Aug 3, 2026 (4)). Separate-deck cards are still members; each caller decides what to do with them.
 */
const identitySetMembers = (identity: HeroIdentityCard, cards: ReadonlyMap<string, AnyCard>): readonly PlayerCard[] =>
  [...cards.values()].filter(
    (card): card is PlayerCard => isPlayerDeckCard(card) && card.aspect === `hero:${identity.id}` && !isLinked(card),
  );

/**
 * The identity-set cards every deck for `identity` must hold, each at its exact set quantity
 * (Appendix I, p. 50: "The exact quantity of each card included in that identity set must be
 * included in the deck").
 *
 * Cards of the identity's separate decks are left out, because setup builds those decks. A card
 * whose data has no valid set quantity is left out too, and `validateDeck` reports it.
 *
 * The deck builder starts a new deck from this, so a player isn't made to add every signature
 * card by hand. `validateDeck` reads set membership from the same `identitySetMembers`, so the
 * two cannot disagree about which cards are required.
 */
export function requiredIdentitySet(identity: HeroIdentityCard, pool: CardPool): readonly DeckCardEntry[] {
  return identitySetMembers(identity, indexPool(pool))
    .filter(
      (card) => card.separateDeck === undefined && Number.isInteger(card.quantityInSet) && card.quantityInSet >= 1,
    )
    .map((card) => ({ cardId: card.id, quantity: card.quantityInSet }))
    .sort((a, b) => (a.cardId as string).localeCompare(b.cardId as string));
}

/** RRG 1.8 Appendix III, item 8 "Deckbuilding Classification": exclusive to a hero, an aspect, or basic. */
type Classification =
  | { readonly kind: "basic" }
  | { readonly kind: "aspect"; readonly aspect: CoreAspect }
  | { readonly kind: "identity"; readonly identityId: string }
  | { readonly kind: "unrecognized"; readonly raw: string };

function classify(card: PlayerCard): Classification {
  const raw = card.aspect as string;
  if (raw === "basic") return { kind: "basic" };
  if (raw.startsWith("hero:")) return { kind: "identity", identityId: raw.slice("hero:".length) };
  if (CHOOSABLE_ASPECTS.includes(raw as CoreAspect)) return { kind: "aspect", aspect: raw as CoreAspect };
  return { kind: "unrecognized", raw };
}

interface Line {
  readonly card: PlayerCard;
  readonly quantity: number;
  readonly classification: Classification;
}

/**
 * Lines grouped into copies of one card, keyed by a player-readable label. RRG 1.8 "Copy"
 * (p. 13): "A copy of a card is defined by title. A second copy of a card is any other card
 * that shares the same title and subtitle (if any), regardless of card's type, text, artwork,
 * or any other differing characteristics between the cards." So different card codes can be
 * copies of each other; Core's four "Wakanda Forever!" codes are one card.
 */
const byTitle = (lines: readonly Line[]): ReadonlyMap<string, readonly Line[]> => {
  const groups = new Map<string, Line[]>();
  for (const line of lines) {
    const label = uniqueLabel(line.card);
    groups.set(label, [...(groups.get(label) ?? []), line]);
  }
  return groups;
};

/**
 * The most copies of a title a deck may hold. The three-copy rule for a non-unique card is
 * lowered by the card's deck limit (MarvelCDB `deck_limit`, the data form of a printed "Max X
 * per deck"; RRG 1.8 "Max, Maximum", p. 28). A unique card is limited to one by the unique
 * rule. `null` means the data cannot say.
 */
function maxCopies(group: readonly Line[]): number | null {
  if (group.some((line) => isUnique(line.card))) return 1;
  let limit = DECK_COPY_LIMIT;
  for (const { card } of group) {
    if (!Number.isInteger(card.deckLimit) || card.deckLimit < 1) return null;
    limit = Math.min(limit, card.deckLimit);
  }
  return limit;
}

/**
 * Whether `deck` is a legal player deck under RRG 1.8 Appendix I, judged against `pool`.
 *
 * `context` says where the deck is being built. **Without one — every caller that predates campaign mode — the
 * verdict and every message are exactly what they were before campaign mode existed.** With a campaign context the
 * rules that only exist inside a campaign apply: a campaign-specific card of that campaign's own product becomes
 * legal once the campaign has granted it (RRG 1.8 p. 11), granted cards stop counting toward deck size (MC10 p. 3),
 * the identity is locked (MC10 p. 3), a card removed from the campaign is refused (RRG 1.8 p. 29), the box's own
 * prohibitions apply (MC27 p. 4; MC40 p. 6), and a frozen deck cannot be edited (MC16 p. 5; MC27 p. 6).
 *
 * Every problem is reported, not just the first, in a fixed order. Checks that would only
 * repeat an earlier problem are skipped. For example, a deck whose aspect choice is
 * itself illegal is not also told that each of its aspect cards is off-aspect.
 *
 * Not checked here, because it is a table-level rule rather than a property of one deck:
 * Appendix I's Team-Up replacement ("If a player's deck includes an identity-specific card
 * that ... match[es] an identity chosen by another player during setup, that player may
 * replace the matching card in their deck with a card with the Team-Up keyword that names
 * both their own identity and the other player's identity").
 */
export function validateDeck(deck: DeckContents, pool: CardPool, context?: DeckContext): DeckValidation {
  const cards = indexPool(pool);
  const problems: DeckProblem[] = [];
  const add = (code: DeckProblemCode, message: string, cardIds: readonly CardId[] = []): void => {
    problems.push({ code, message, cardIds });
  };

  // ---- The campaign, if this deck belongs to one ----------------------------------------
  // Every campaign rule below is reached only through `campaign`, so a deck with no context is judged by exactly
  // the code — and worded by exactly the messages — it was before campaign mode existed.
  const campaign = context?.campaign;
  /** How many copies of a title the campaign gave this player (MC10 p. 3); 0 for everything it did not. */
  const grantedCopies = (cardId: string): number =>
    campaign === undefined ? 0 : campaign.grantedCardIds.filter((granted) => granted === cardId).length;
  /**
   * RRG 1.8 p. 29, by face. A deck lists a card by its front face, so a removal that names the *other* face leaves
   * the card usable — ruling April 30, 2026 (4) answer 2, "Prelate versions of minions remain available … even if
   * their Overseer counterparts were crossed out of the campaign log".
   */
  const isRemovedFromCampaign = (cardId: string): boolean =>
    (campaign?.removedFromCampaign ?? []).some((face) => face.cardId === cardId && face.face === undefined);
  const isProhibited = (card: AnyCard): boolean => {
    if (!campaign) return false;
    if (campaign.prohibitedCardIds?.includes(card.id)) return true;
    const set = "specificTo" in card ? card.specificTo?.encounterSetId : undefined;
    return set !== undefined && (campaign.prohibitedEncounterSetIds?.includes(set) ?? false);
  };

  /**
   * What the campaign has taken away, reported once per line: RRG 1.8 p. 29's removal first, then the box's own
   * prohibition (MC27 p. 4; MC40 p. 6). Both are false with no campaign context, so a standalone deck never
   * reaches either.
   */
  const campaignTookAway = (card: AnyCard, name: string): boolean => {
    if (isRemovedFromCampaign(card.id)) {
      add(
        "campaign_removed_card",
        `${name} has been removed from this campaign and can no longer be used during the rest of it, even on a retry.`,
        [card.id],
      );
      return true;
    }
    if (isProhibited(card)) {
      add("campaign_prohibited_card", `${name} cannot be used during this campaign.`, [card.id]);
      return true;
    }
    return false;
  };

  // ---- The identity ---------------------------------------------------------------------
  // Appendix I: "A player must choose exactly one identity card." The shape of `Deck` allows
  // exactly one, so what is left to check is that it names a hero identity.
  const identityCard = cards.get(deck.identityCardId);
  let identity: HeroIdentityCard | null = null;
  if (!identityCard) {
    add("unknown_card", `The chosen identity (card code ${deck.identityCardId}) is not in the card pool.`, [
      deck.identityCardId,
    ]);
  } else if (identityCard.type !== "hero_identity") {
    add(
      "not_an_identity",
      `${uniqueLabel(identityCard)} is a ${typeName(identityCard)} card, not an identity: a deck is built around exactly one hero identity.`,
      [deck.identityCardId],
    );
  } else {
    identity = identityCard;
    if (identityCard.separatedIdentity !== undefined) {
      add(
        "unsupported_identity",
        `${uniqueLabel(identityCard)} is split across two identity cards (a separated identity), which this build cannot play yet.`,
        [identityCard.id],
      );
    }
    const unbuilt = unbuildableSeparateDeck(identityCard);
    if (unbuilt) {
      add(
        "unsupported_identity",
        `${uniqueLabel(identityCard)} brings a ${unbuilt.name} deck of a kind this build cannot play yet.`,
        [identityCard.id],
      );
    }
  }
  // MC10 p. 3: "Each player must use their chosen identity for the entire campaign." The seat's identity is a
  // campaign-log fact, so a deck naming a different one is refused rather than quietly reseating the player.
  if (campaign && deck.identityCardId !== campaign.identityCardId) {
    const locked = cards.get(campaign.identityCardId);
    add(
      "campaign_identity_locked",
      `This campaign is being played with ${locked ? uniqueLabel(locked) : `identity ${campaign.identityCardId}`}; a player must use their chosen identity for the entire campaign, so this deck's identity cannot change.`,
      [deck.identityCardId],
    );
  }
  const identityName = identity ? uniqueLabel(identity) : null;

  // ---- Each line of the list ------------------------------------------------------------
  const lines: Line[] = [];
  const listed = new Set<string>();
  /** Cards counted toward deck size (see the deck-size check). */
  let counted = 0;
  for (const entry of deck.cards as readonly DeckCardEntry[]) {
    const card = cards.get(entry.cardId);
    const name = card ? uniqueLabel(card) : `Card code ${entry.cardId}`;
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1) {
      add(
        "invalid_quantity",
        `${name} is listed with quantity ${String(entry.quantity)}; a quantity must be a whole number of at least 1.`,
        [entry.cardId],
      );
      continue;
    }
    if (listed.has(entry.cardId)) {
      add("duplicate_entry", `${name} is listed more than once; list each card once with its total quantity.`, [
        entry.cardId,
      ]);
      continue;
    }
    listed.add(entry.cardId);
    if (!card) {
      // Counted toward size: it is in the list, and an unknown card cannot be permanent.
      counted += entry.quantity;
      add("unknown_card", `Card code ${entry.cardId} is not in the card pool.`, [entry.cardId]);
      continue;
    }
    if (card.type === "hero_identity") {
      add(
        "identity_in_deck",
        `${name} is an identity card; the identity is chosen separately and is not part of the card list.`,
        [card.id],
      );
      continue;
    }
    if (card.type === "evidence") {
      // The Agents of S.H.I.E.L.D. rulebook, "Gathering Evidence" (p. 6): "Evidence cards are not added to any deck".
      counted += entry.quantity;
      add(
        "not_a_player_card",
        `${name} is an evidence card: evidence cards are kept in the A.I.M. and S.H.I.E.L.D. envelopes and are never added to a deck.`,
        [card.id],
      );
      continue;
    }
    if (card.type === "obligation" && grantedCopies(card.id) >= entry.quantity) {
      // The one encounter card a campaign may put in a player deck. MC10 p. 17, "Obligations in Player Decks":
      // "The obligations in the expert campaign sets have player-card backs because they are meant to be added to
      // player decks, but they are still encounter cards." Legal only because the campaign put it there — an
      // obligation is never a deckbuilding choice, so the exemption is exactly the copies the campaign granted,
      // and an ungranted copy falls through to the ordinary "encounter cards cannot be in a player deck" refusal
      // below. Like every grant it is exempt from deck size (MC10 p. 3) and reaches no further check, but the
      // campaign can still have taken it away (RRG 1.8 p. 29).
      campaignTookAway(card, name);
      continue;
    }
    if (!isPlayerDeckCard(card)) {
      // RRG 1.8 "Identity-Specific Card" (p. 23) and "Obligation" (p. 30): an identity's
      // obligation and nemesis set are identity-specific but are encounter cards. Setup adds
      // them (Appendix II steps 4–5); they are never in the player deck.
      counted += entry.quantity;
      add(
        "not_a_player_card",
        `${name} is a ${typeName(card)} card, not a player card: encounter cards (including obligations and nemesis cards, which setup adds for you) cannot be in a player deck.`,
        [card.id],
      );
      continue;
    }
    if (isLinked(card)) {
      // RRG 1.8 "Linked (Card Title)" (p. 27): "cannot be included in any deck ... Linked cards
      // do not count toward the minimum or maximum deck size." Reaffirmed by FFG ruling Aug 3, 2026
      // (ruling 4): "Linked cards cannot be included in decks", even through campaign rewards.
      add(
        "linked_card",
        `${name} has the Linked keyword: linked cards cannot be included in a deck; they are set aside at setup by the card that brings them into play.`,
        [card.id],
      );
      continue;
    }
    if (card.separateDeck !== undefined) {
      // RRG 1.8 "Deck" (p. 15): "Certain identities or scenarios may add other decks to the game." The Doctor Strange
      // Hero Pack insert: "he begins each game with a special, five-card 'INVOCATION deck' in addition to his player
      // deck. To create the INVOCATION deck, shuffle all five of Doctor Strange's INVOCATION cards together". Its
      // contents are fixed by the identity, so the card is never part of a player deck and is not counted toward size.
      const set = classify(card);
      const owner = set.kind === "identity" ? cards.get(set.identityId) : undefined;
      add(
        "separate_deck_card",
        `${name} belongs to ${owner ? `${uniqueLabel(owner)}'s` : "an identity's"} ${card.separateDeck} deck, which setup builds from the identity; it is not part of a player deck, so it cannot be listed.`,
        [card.id],
      );
      continue;
    }
    // RRG 1.8 p. 29 and MC27 p. 4 / MC40 p. 6: gone for the rest of the campaign, or never allowed inside it.
    // Checked before everything below, so a removed card is reported once, as removed.
    if (campaignTookAway(card, name)) continue;
    if (card.specificTo !== undefined) {
      // Neither kind is a deckbuilding choice: a campaign adds campaign cards (and, in The Rise of Red Skull, rescued
      // Captive allies) to decks by its own instructions, "Cards added to the deck as part of a campaign do not count
      // toward a player's minimum or maximum deck size" (the Red Skull rulebook, p. 3). Not counted here either.
      if (card.specificTo.kind === "campaign") {
        // RRG 1.8 "Campaign-Specific Card" (p. 11): "Campaign-specific cards can only be used during a campaign from
        // the same product (determined by that product's set icon)." Inside that campaign the card is legal, but
        // only because the campaign put it there (the Red Skull rulebook, p. 3, "Campaign-Only Cards"). A legal one
        // falls through to no further checks, exactly as it always has: it is not counted toward deck size, and the
        // three-copy rule does not reach it.
        if (!campaign) {
          add(
            "campaign_card",
            `${name} is a campaign card: it can only be used during a campaign from the same product, and this deck is not being built for a campaign.`,
            [card.id],
          );
        } else if (!campaign.campaignSetIds.includes(card.specificTo.encounterSetId)) {
          add(
            "campaign_card",
            `${name} is a campaign card from a different product: a campaign-specific card can only be used during a campaign from its own product.`,
            [card.id],
          );
        } else if (grantedCopies(card.id) < entry.quantity) {
          add(
            "campaign_card_not_granted",
            `${name} is a campaign card: it can only be in this deck if the campaign directed the player to add it, and the campaign has added ${copies(grantedCopies(card.id))}.`,
            [card.id],
          );
        }
      } else if (card.specificTo.kind === "competitive") {
        add(
          "competitive_card",
          `${name} is used only in competitive (team-vs-team) mode, which is not available yet.`,
          [card.id],
        );
      } else if (grantedCopies(card.id) < entry.quantity) {
        // A scenario-specific card is not a deckbuilding choice either — but a campaign instruction can still add
        // one to a deck, and then it is as legal as any other grant: MC10 p. 10, "Each player who rescued one or
        // more allies from the Taskmaster encounter set **adds those allies to their deck** and records their
        // names in the campaign log" (the same sentence's cards stay refused for every copy the campaign did not
        // grant, and for every deck that is not this campaign's). MC10 p. 12 then takes an unrescued one back out
        // through RRG 1.8 p. 29's removal, which `campaignTookAway` has already checked above.
        add(
          "scenario_card",
          `${name} belongs to a scenario's own set of cards and enters the game only through that scenario, so it cannot be put in a deck.`,
          [card.id],
        );
      }
      continue;
    }
    // RRG 1.8 "Permanent" (p. 32): "Permanent cards do not count towards a player's minimum or maximum deck size."
    // MC10 p. 3 exempts campaign grants the same way, so only the copies the player chose are counted.
    if (!hasPlainKeyword(card, "permanent")) counted += Math.max(0, entry.quantity - grantedCopies(card.id));
    const classification = classify(card);
    if (classification.kind === "unrecognized") {
      add(
        "unrecognized_classification",
        `${name} has the deckbuilding classification ${aspectName(classification.raw)}, which this build cannot check, so it cannot be put in a deck yet.`,
        [card.id],
      );
      continue;
    }
    lines.push({ card, quantity: entry.quantity, classification });
  }

  // ---- The identity's own deckbuilding requirements -------------------------------------
  const rules = identity?.deckbuilding;
  if (identity && rules?.unmodeled) {
    for (const text of rules.unmodeled) {
      add(
        "unsupported_deckbuilding_requirement",
        `${identityName} has a deckbuilding requirement this build cannot check yet: "${text}"`,
        [identity.id],
      );
    }
  }
  let aspectCount = 1;
  if (identity && rules?.aspectCount !== undefined) {
    if (Number.isInteger(rules.aspectCount) && rules.aspectCount >= 1) aspectCount = rules.aspectCount;
    else
      add(
        "missing_card_data",
        `${identityName}'s card data gives an invalid number of aspects to choose (${String(rules.aspectCount)}).`,
        [identity.id],
      );
  }

  // ---- Aspect choice --------------------------------------------------------------------
  // RRG 1.8 "Aspect Card" (p. 8): "a player must choose one of the five aspects ... to use for customization."
  let aspectChoiceOk = true;
  const chosen: CoreAspect[] = [];
  for (const aspect of deck.aspects) {
    if (aspect === "basic") {
      aspectChoiceOk = false;
      add(
        "aspect_choice",
        "Basic is not an aspect: basic cards may go in any deck, and a deck still chooses an aspect (Aggression, Justice, Leadership, Protection or 'Pool).",
      );
    } else if (!CHOOSABLE_ASPECTS.includes(aspect)) {
      aspectChoiceOk = false;
      add(
        "aspect_choice",
        `${aspectName(aspect)} is not an aspect a deck can choose; choose from Aggression, Justice, Leadership, Protection or 'Pool.`,
      );
    } else if (chosen.includes(aspect)) {
      aspectChoiceOk = false;
      add("aspect_choice", `${aspectName(aspect)} is chosen more than once; each chosen aspect must be different.`);
    } else {
      chosen.push(aspect);
    }
  }
  if (aspectChoiceOk && chosen.length !== aspectCount) {
    aspectChoiceOk = false;
    const who = identityName ?? "This deck";
    const need = aspectCount === 1 ? "exactly one aspect" : `exactly ${aspectCount} different aspects`;
    const have = chosen.length === 0 ? "none" : chosen.map(aspectName).join(" and ");
    add(
      "aspect_choice",
      `${who === "This deck" ? who : `A deck for ${who}`} must choose ${need}; this deck chooses ${have}.`,
    );
  }

  // ---- Deck size ------------------------------------------------------------------------
  if (counted < DECK_MIN_CARDS || counted > DECK_MAX_CARDS) {
    add(
      "deck_size",
      `The deck has ${counted} cards; a deck must have between ${DECK_MIN_CARDS} and ${DECK_MAX_CARDS} (the identity and permanent cards do not count).`,
    );
  }

  // ---- Identity-specific cards ----------------------------------------------------------
  // RRG 1.8 "Identity-Specific Card" (p. 23): "Identity-specific cards ... may only be used
  // alongside an identity if those cards share a set icon with that identity." Set-icon
  // membership is `aspect: "hero:<identity card id>"` in the card data.
  for (const line of lines) {
    if (line.classification.kind !== "identity" || !identity) continue;
    if (line.classification.identityId === identity.id) continue;
    const owner = cards.get(line.classification.identityId);
    const ownerName = owner ? uniqueLabel(owner) : `identity ${line.classification.identityId}`;
    add(
      "other_identity_card",
      `${uniqueLabel(line.card)} belongs to ${ownerName}'s identity set; identity-specific cards can only be used in that identity's deck.`,
      [line.card.id],
    );
  }
  if (identity) {
    // The identity's separate decks (RRG 1.8 "Deck", p. 15; the Doctor Strange Hero Pack insert). Their contents are
    // fixed by the identity and built at setup, so legality only checks that the data can build them: every listed card
    // is in the pool and is marked as belonging to that deck. Bad data is reported, never guessed around.
    for (const separate of identity.separateDecks ?? []) {
      for (const entry of separate.cards) {
        const card = cards.get(entry.cardId);
        if (!card) {
          add(
            "missing_card_data",
            `${identityName}'s ${separate.name} deck lists card code ${entry.cardId}, which is not in the card pool, so that deck cannot be built.`,
            [entry.cardId],
          );
        } else if (!isPlayerDeckCard(card) || card.separateDeck !== separate.name) {
          add(
            "missing_card_data",
            `${identityName}'s ${separate.name} deck lists ${uniqueLabel(card)}, but that card's data does not mark it as part of the ${separate.name} deck, so that deck cannot be built.`,
            [card.id],
          );
        }
      }
    }
    const inDeck = new Map(lines.map((line) => [line.card.id as string, line.quantity]));
    // Membership is `identitySetMembers`, which `requiredIdentitySet` also uses, so the deck
    // builder's starting deck and this check agree on what the set requires.
    for (const card of identitySetMembers(identity, cards)) {
      if (card.separateDeck !== undefined) {
        // Part of the identity's set, but it goes into its separate deck at setup, not into the player deck.
        const listed = (identity.separateDecks ?? []).some(
          (d) => d.name === card.separateDeck && d.cards.some((e) => e.cardId === card.id),
        );
        if (!listed) {
          add(
            "missing_card_data",
            `${uniqueLabel(card)} is marked as part of ${identityName}'s ${card.separateDeck} deck, but the identity's data does not list it there, so that deck cannot be built.`,
            [card.id],
          );
        }
        continue;
      }
      const need = card.quantityInSet;
      if (!Number.isInteger(need) || need < 1) {
        add(
          "missing_card_data",
          `${uniqueLabel(card)}'s card data has no valid quantity in ${identityName}'s identity set, so the required count cannot be checked.`,
          [card.id],
        );
        continue;
      }
      const have = inDeck.get(card.id) ?? 0;
      if (have === need) continue;
      add(
        "identity_set_mismatch",
        have === 0
          ? `${uniqueLabel(card)} is missing: a deck for ${identityName} must include every card in that identity's set, and this one needs ${copies(need)}.`
          : `${uniqueLabel(card)} has ${copies(have)}, but ${identityName}'s identity set has exactly ${copies(need)}, and a deck must include exactly that many.`,
        [card.id],
      );
    }
  }

  // ---- Aspect restriction, off-aspect packages, equal split ------------------------------
  // Appendix I: "The remainder of their deck is then customized with cards that belong to that
  // aspect and/or basic cards." Skipped when the choice itself was illegal (reported above).
  const packages = identity ? (rules?.offAspectPackages ?? []) : [];
  if (aspectChoiceOk) {
    const packageLines: Line[][] = packages.map(() => []);
    for (const line of lines) {
      if (line.classification.kind !== "aspect" || chosen.includes(line.classification.aspect)) continue;
      const index = packages.findIndex((p) => line.card.type === p.cardType && line.card.traits.includes(p.trait));
      if (index >= 0) {
        packageLines[index]?.push(line);
        continue;
      }
      add(
        "aspect_restriction",
        `${uniqueLabel(line.card)} is a ${aspectName(line.classification.aspect)} card, but this deck's aspect is ${chosen.map(aspectName).join(" and ")}; beyond its identity set a deck may only use its chosen aspect and basic cards.`,
        [line.card.id],
      );
    }
    for (const [index, pkg] of packages.entries()) {
      const taken = packageLines[index] ?? [];
      if (taken.length === 0) continue; // All or nothing: none is legal.
      const groups = byTitle(taken);
      const short = [...groups.entries()].filter(([, group]) => {
        const max = maxCopies(group);
        return max === null || group.reduce((n, line) => n + line.quantity, 0) !== max;
      });
      if (groups.size === pkg.titles && short.length === 0) continue;
      const kind = `${String(pkg.trait)} ${pkg.cardType.replace(/_/g, " ")}`;
      const detail =
        groups.size !== pkg.titles
          ? `this deck has ${groups.size} different ones`
          : `not at their maximum copies: ${short.map(([title]) => title).join(", ")}`;
      add(
        "deckbuilding_requirement",
        `${identityName}'s deckbuilding requirement: a ${kind} card from outside the chosen aspect is allowed only as the maximum copies of exactly ${pkg.titles} different titles, or none at all; ${detail}.`,
        taken.map((line) => line.card.id),
      );
    }
    if (identity && rules?.equalCardsPerAspect && chosen.length > 1) {
      const counts = chosen.map((aspect) =>
        lines.reduce(
          (n, line) =>
            line.classification.kind === "aspect" && line.classification.aspect === aspect ? n + line.quantity : n,
          0,
        ),
      );
      if (new Set(counts).size > 1) {
        const summary = chosen.map((aspect, i) => `${counts[i]} ${aspectName(aspect)}`).join(" and ");
        add(
          "deckbuilding_requirement",
          `${identityName}'s deckbuilding requirement: the deck must include an equal number of cards from each chosen aspect; it has ${summary}.`,
          [identity.id],
        );
      }
    }
  }

  // ---- Copies by title (non-unique) -----------------------------------------------------
  // Applied to cards outside the identity set only. RRG 1.8 Appendix I requires "the exact
  // quantity of each card included in that identity set", and Core's verified Black Panther
  // precon holds 5 copies of "Wakanda Forever!" (4 codes), more than the three-copy rule
  // allows. The RRG does not reconcile the two bullets. The specific rule (identity set,
  // checked above as `identity_set_mismatch`) governs its own cards, and the general
  // three-copy rule governs the rest. Flagged for FFG.
  for (const [title, group] of byTitle(lines.filter((line) => line.classification.kind !== "identity"))) {
    if (group.some((line) => isUnique(line.card))) continue; // The unique rule governs these (below).
    // `CAMPAIGN_GRANTS_COUNT_TOWARD_COPY_LIMIT` is the design's Q8 decision point; see its doc comment.
    const granted = CAMPAIGN_GRANTS_COUNT_TOWARD_COPY_LIMIT
      ? 0
      : group.reduce((n, line) => n + Math.min(line.quantity, grantedCopies(line.card.id)), 0);
    const total = group.reduce((n, line) => n + line.quantity, 0) - granted;
    const limit = maxCopies(group);
    const ids = group.map((line) => line.card.id);
    if (limit === null) {
      add(
        "missing_card_data",
        `${title}'s card data has no valid deck limit, so its copy limit cannot be checked.`,
        ids,
      );
    } else if (total > limit) {
      add(
        "copy_limit",
        limit === DECK_COPY_LIMIT
          ? `${title} has ${copies(total)}; a deck may include no more than ${DECK_COPY_LIMIT} copies of a non-unique card (by title).`
          : `${title} has ${copies(total)}, but its deck limit is ${limit}: no more than ${copies(limit)} may be in a deck.`,
        ids,
      );
    }
  }

  // ---- Unique: the deckbuilding half ----------------------------------------------------
  // RRG 1.8 "Unique Icon" (pp. 45–46): "During deckbuilding, a player cannot include multiple
  // matching cards in their deck. The identity is included in this evaluation." Two copies of
  // one unique card always match each other (`cardsMatch` is reflexive on unique cards).
  const uniques: { readonly card: AnyCard; readonly quantity: number }[] = [
    ...(identity ? [{ card: identity as AnyCard, quantity: 1 }] : []),
    ...lines
      .filter((line) => isUnique(line.card))
      .map((line) => ({ card: line.card as AnyCard, quantity: line.quantity })),
  ];
  for (const [i, a] of uniques.entries()) {
    if (a.quantity > 1) {
      add(
        "unique_match",
        `${uniqueLabel(a.card)} is unique, and a deck cannot include matching unique cards, so it may be included only once (this deck has ${a.quantity}).`,
        [a.card.id],
      );
    }
    for (const b of uniques.slice(i + 1)) {
      if (!cardsMatch(a.card, b.card)) continue;
      add(
        "unique_match",
        a.card === identity
          ? `${uniqueLabel(b.card)} matches the identity ${identityName}; a deck cannot include a unique card that matches its own identity.`
          : `${uniqueLabel(a.card)} and ${uniqueLabel(b.card)} match; a deck cannot include multiple matching unique cards.`,
        [a.card.id, b.card.id],
      );
    }
  }

  // ---- Team-Up --------------------------------------------------------------------------
  // RRG 1.8 "Team-Up" (p. 43): "You cannot include this card in your deck unless your alter-ego
  // or hero title matches name 1 or name 2."
  for (const line of lines) {
    const teamUp = teamUpOf(line.card);
    if (!teamUp) continue;
    if (!teamUp.names) {
      add(
        "missing_card_data",
        `${uniqueLabel(line.card)} has the Team-Up keyword, but its card data does not name the two characters, so it cannot be checked.`,
        [line.card.id],
      );
      continue;
    }
    if (!identity) continue;
    const titles = [
      identity.name,
      identity.hero.faceName,
      identity.alterEgo.faceName,
      ...(identity.additionalHeroForms ?? []).map((form) => form.faceName),
    ];
    if (teamUp.names.some((name) => titles.includes(name))) continue;
    add(
      "team_up_identity",
      `${uniqueLabel(line.card)} is a Team-Up card for ${teamUp.names[0]} and ${teamUp.names[1]}; only a deck whose identity is one of them may include it.`,
      [line.card.id],
    );
  }

  // ---- The campaign's deck freeze -------------------------------------------------------
  // MC16 p. 5: after the first scenario "players may not change their decks for the rest of the campaign"; MC27
  // p. 6 prints the same freeze as an optional rule. Only the lines the *player* chose are frozen — the campaign
  // keeps adding its own cards, so granted copies are subtracted from both sides before they are compared.
  if (campaign?.frozenNonCampaignCards) {
    const frozen = new Map(campaign.frozenNonCampaignCards.map((entry) => [entry.cardId as string, entry.quantity]));
    const chosen = new Map<string, number>();
    for (const entry of deck.cards) {
      const own = entry.quantity - grantedCopies(entry.cardId);
      if (own > 0) chosen.set(entry.cardId, own);
    }
    for (const cardId of new Set([...frozen.keys(), ...chosen.keys()])) {
      const was = frozen.get(cardId) ?? 0;
      const now = chosen.get(cardId) ?? 0;
      if (was === now) continue;
      const card = cards.get(cardId);
      const label = card ? uniqueLabel(card) : `Card code ${cardId}`;
      add(
        "campaign_deck_frozen",
        was === 0
          ? `${label} cannot be added: deck customization is frozen for the rest of this campaign.`
          : now === 0
            ? `${label} cannot be removed: deck customization is frozen for the rest of this campaign.`
            : `${label} has ${copies(now)}, but deck customization is frozen for the rest of this campaign at ${copies(was)}.`,
        [cardId as CardId],
      );
    }
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}

/**
 * Every ability reference printed anywhere on a card: every identity face (including a three-sided identity's
 * `additionalHeroForms`), every villain stage, every main scheme side, and the other face of a double-sided card.
 */
export function abilityRefsOf(card: AnyCard): readonly AbilityReference[] {
  switch (card.type) {
    case "hero_identity":
      return [
        ...card.hero.abilities,
        ...card.alterEgo.abilities,
        ...(card.additionalHeroForms ?? []).flatMap((form) => form.abilities),
        ...(card.separatedIdentity
          ? [
              ...card.separatedIdentity.heroCardOtherSide.abilities,
              ...card.separatedIdentity.alterEgoCardOtherSide.abilities,
            ]
          : []),
      ];
    case "villain":
      return card.sides.flatMap((side) => side.stages.flatMap((stage) => stage.abilities));
    case "main_scheme":
      return card.stages.flatMap((stage) => [...stage.aSide.abilities, ...stage.abilities]);
    default:
      return "flipSide" in card && card.flipSide ? [...card.abilities, ...card.flipSide.abilities] : card.abilities;
  }
}

/**
 * Playability, kept separate from legality. Returns the cards a game seated with this deck
 * would use that reference an ability with no entry in `deps.abilities`.
 *
 * "Would use" is the identity, every listed card, and the identity's obligation and nemesis
 * set. Setup brings those into the game (RRG 1.8 Appendix II steps 4–5), so a deck whose
 * obligation is unscripted is no more playable than one whose ally is. Order: identity,
 * then the list in order, then the obligation and nemesis cards in pool order. Each id
 * appears once. A card code not in `pool` is skipped here; `validateDeck` reports it as
 * `unknown_card`.
 *
 * This checks registry coverage only. A card with no ability references at all is treated
 * as needing no script.
 */
export function unscriptedCards(deck: DeckContents, pool: CardPool, deps: EngineDeps): readonly CardId[] {
  const cards = indexPool(pool);
  const result: CardId[] = [];
  const seen = new Set<string>();
  const consider = (card: AnyCard | undefined): void => {
    if (!card || seen.has(card.id)) return;
    seen.add(card.id);
    if (abilityRefsOf(card).some((ref) => deps.abilities[ref.id] === undefined)) result.push(card.id);
  };
  const identity = cards.get(deck.identityCardId);
  consider(identity);
  for (const entry of deck.cards) consider(cards.get(entry.cardId));
  if (identity?.type === "hero_identity") {
    // An identity's separate decks (the Invocation deck) are built at setup from the identity, so they are used too.
    for (const separate of identity.separateDecks ?? []) {
      for (const entry of separate.cards) consider(cards.get(entry.cardId));
    }
    consider(cards.get(identity.obligationCardId));
    for (const card of cards.values()) {
      if ("encounterSetIds" in card && card.encounterSetIds.includes(identity.nemesisEncounterSetId)) consider(card);
    }
  }
  return result;
}
