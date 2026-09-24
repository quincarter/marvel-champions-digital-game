import type { CardText, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { ArtRef, CardId, EncounterSetId, ImageRef } from "../ids.js";
import type { BaseCard, CardType } from "./base.js";
import type { CardFlipSide } from "./encounter-cards.js";

/**
 * RRG 1.8 Appendix I "Deck Customization" (p. 50): "Any 'deckbuilding requirements' on the
 * player's identity card must be followed."
 *
 * These are rules exceptions that belong to one identity, so they are data on that identity
 * and the engine never names a card. Absent means the Appendix I defaults apply. Each field
 * is transcribed from an FAQ ruling that states the behavior outright; anything the fields
 * cannot express yet goes in `unmodeled`, so validation reports it instead of guessing.
 */
export interface IdentityDeckbuilding {
  /**
   * How many aspects the deck chooses for customization. Appendix I's default is exactly one.
   * RRG 1.8 FAQ "Jessica Drew (#31B)" (p. 60): "Does Jessica Drew's Double Agent ability
   * require her deck to be built with two aspects? A: Yes."
   */
  readonly aspectCount?: number;
  /** Same FAQ: "An equal number of cards from two different aspects must be included in her deck." */
  readonly equalCardsPerAspect?: boolean;
  /** Bundles of cards the deck may take from outside its chosen aspect(s). All or nothing (see `OffAspectPackage`). */
  readonly offAspectPackages?: readonly OffAspectPackage[];
  /**
   * Gamora (`gam` 18001b), Skilled Tactician: "You may include up to 6 attack and/or thwart events in your deck from
   * aspects other than your chosen aspect." → `{ cardType: "event", anyTrait: [ATTACK, THWART], maxCards: 6 }`: any
   * number of titles, at most `maxCards` cards in total, each of `cardType` with at least one of `anyTrait`, from any
   * aspect not chosen. Unlike `offAspectPackages` (Maria Hill's all-or-nothing), taking fewer is legal.
   * docs/phase7-wave3.md §1.5.
   */
  readonly offAspectAllowance?: OffAspectAllowance;
  /**
   * Adam Warlock (`mts` 21031b), Avatar of Life: "You cannot include more than 1 copy of any non-Adam Warlock card."
   * Every card outside the identity's own set (aspect and basic alike) is limited to this many copies by title, below
   * its own `deckLimit` when that is higher. MC21 p. 3: "he cannot include more than one copy of any aspect card in his
   * deck". A positive whole number. docs/phase7-wave4.md §1.4.
   */
  readonly maxCopiesPerTitle?: number;
  /**
   * The printed text of requirements the fields above cannot express yet. A non-empty list makes
   * `validateDeck` report `unsupported_deckbuilding_requirement`, so the deck cannot be seated
   * until the requirement is modeled.
   */
  readonly unmodeled?: readonly string[];
}

/**
 * RRG 1.8 FAQ "Maria Hill (#1B)" (p. 64): "You must include the maximum number of copies of
 * each of exactly three S.H.I.E.L.D. supports from aspects other than your chosen aspect, or
 * else you cannot have any S.H.I.E.L.D. supports from other aspects in your deck."
 * For that ruling the fields are `{ cardType: "support", trait: "S.H.I.E.L.D.", titles: 3 }`.
 */
export interface OffAspectPackage {
  readonly cardType: CardType;
  readonly trait: Trait;
  /** Exactly this many distinct titles, each at its maximum copies, or none at all. */
  readonly titles: number;
}

/** See `IdentityDeckbuilding.offAspectAllowance`. */
export interface OffAspectAllowance {
  readonly cardType: CardType;
  readonly anyTrait: readonly Trait[];
  /** Cards in total, not titles: a whole number of at least 1. */
  readonly maxCards: number;
}

export interface HeroFace {
  readonly faceName: string;
  readonly atk: number;
  readonly thw: number;
  readonly def: number;
  readonly handSize: number;
  /** Keywords are per face (Black Panther's Retaliate 1 is hero-side only). */
  readonly keywords: readonly KeywordInstance[];
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  readonly art?: ArtRef;
  /** Upstream artwork for this face. The identity's `images` carries both. */
  readonly image?: ImageRef;
}

export interface AlterEgoFace {
  readonly faceName: string;
  readonly rec: number;
  readonly handSize: number;
  readonly keywords: readonly KeywordInstance[];
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  readonly art?: ArtRef;
  /** Upstream artwork for this face. The identity's `images` carries both. */
  readonly image?: ImageRef;
}

/**
 * One double-sided card, modeled as one record. HP is on the identity, not a
 * face: damage persists across a flip (RRG "Identity"), so it's shared state.
 * Traits and keywords are per-face — e.g. the hero side is AVENGER but the
 * alter-ego is not.
 */
export interface HeroIdentityCard extends BaseCard {
  readonly type: "hero_identity";
  readonly hp: number;
  readonly hero: HeroFace & { readonly traits: readonly Trait[] };
  readonly alterEgo: AlterEgoFace & { readonly traits: readonly Trait[] };
  /** The hero's obligation card, shuffled into the encounter deck at setup. */
  readonly obligationCardId: CardId;
  /** The hero's nemesis encounter set, set aside at setup. */
  readonly nemesisEncounterSetId: EncounterSetId;
  /** Deckbuilding requirements printed on this identity, if any. Absent = RRG Appendix I defaults. */
  readonly deckbuilding?: IdentityDeckbuilding;
  /** Decks this identity brings to the game besides its player deck (Doctor Strange's Invocation deck). */
  readonly separateDecks?: readonly IdentitySeparateDeck[];
  /**
   * Hero forms printed on the identity besides `hero` (wave 2): the inside face of a foldable "three-sided" identity.
   *
   * The Ant-Man Hero Pack insert, "Foldable Cards": "Scott Lang/Ant-Man's identity card is a foldable, 'three-sided'
   * card. One side is his alter-ego form, one side is his TINY hero form, and the inside of the card is his GIANT hero
   * form. Changing form with a three-sided card follows the standard rules for changing form found in the Rules
   * Reference." and "Rules Clarifications": "Scott Lang/Ant-Man can change from alter-ego form to either hero form, from
   * either hero form to alter-ego form, or from one hero form to the other hero form." Wasp (13001a/b/c) is the same.
   * RRG 1.8 "Flip" (p. 20): "A foldable, 'three-sided' card is considered to have flipped any time the faceup side of
   * the card changes."
   *
   * `hero` is the outside hero face (MarvelCDB `…a`, linked to the alter-ego `…b`); each entry here is an inside face
   * (`…c`), which MarvelCDB publishes as a separate, unlinked `hero` record. Hit points stay on the identity: damage
   * persists across every change of form (RRG 1.8 "Form, Change Form", p. 21). Neither form is a default: a player
   * changing from alter-ego form chooses which hero form to change to. Ability ids must be unique across all faces.
   *
   * Data only until the engine tracks which hero face is up (docs/phase7-wave2.md §3.2).
   */
  readonly additionalHeroForms?: readonly (HeroFace & { readonly traits: readonly Trait[] })[];
  /**
   * An identity split across two physical cards (wave 2 schema pass, docs/phase7-wave2.md §6.10). Absent for every
   * ordinary identity, whose hero and alter-ego faces are the two sides of one card.
   *
   * The SP//dr Hero Pack insert, "New Rule: Separated Identity Card": "each side of her identity is split between two
   * separate cards. One card represents the human pilot, Peni Parker, while the other represents the robotic SP//dr
   * Suit. Start the game with the Peni Parker alter-ego in play and, following her 'Setup' instructions, put the
   * INACTIVE support side of the SP//dr Suit card into play. While in alter-ego form, to change to hero form, flip Peni
   * Parker from her alter-ego side to her SP//dr upgrade side and flip the SP//dr Suit card from its INACTIVE support
   * side to its ACTIVE hero side. While in hero form, to change to alter-ego form, flip the SP//dr Suit card from its
   * ACTIVE hero side to its INACTIVE support side and flip the SP//dr upgrade side to its Peni Parker alter-ego side.
   * Both identity cards share a single hit point dial, with damage persisting on the dial between forms. Additionally,
   * if one form is defeated, both forms are considered to be defeated simultaneously and the player is eliminated from
   * the game."
   *
   * `hero` and `alterEgo` stay the identity's two forms (SP//dr Suit ACTIVE, 31001a; Peni Parker's alter-ego side).
   * These fields are the other side of each physical card, which is in play as a card of its own type while its form is
   * not:
   * - `heroCardOtherSide`: the SP//dr Suit card's INACTIVE support side (31001b), in play while in alter-ego form;
   * - `alterEgoCardOtherSide`: Peni Parker's SP//dr upgrade side, in play while in hero form.
   *
   * `alterEgoCardNumber` is the second physical card's collector number (Peni Parker is card 2 of the pack; the
   * identity's own `collectorNumber` is the SP//dr Suit card's). MarvelCDB's cache has no record at all for Peni
   * Parker's card (no 31002 in `spdr.json`; 31001a links to the support side 31001b instead of to an alter-ego), so
   * curation needs a second source for her faces.
   *
   * Data only: the engine does not model two identity cards yet and refuses such an identity at setup.
   */
  readonly separatedIdentity?: SeparatedIdentity;
}

/** The two card-type faces of a separated identity's physical cards (see `HeroIdentityCard.separatedIdentity`). */
export interface SeparatedIdentity {
  readonly alterEgoCardNumber: string;
  readonly heroCardOtherSide: CardFlipSide & { readonly cardType: "support" };
  readonly alterEgoCardOtherSide: CardFlipSide & { readonly cardType: "upgrade" };
}

/**
 * A deck an identity brings to the game in addition to its player deck. RRG 1.8 "Deck" (p. 15): "Certain
 * identities or scenarios may add other decks to the game."
 *
 * The Doctor Strange Hero Pack insert, "The Invocation Deck": "he begins each game with a special, five-card
 * 'INVOCATION deck' in addition to his player deck. To create the INVOCATION deck, shuffle all five of Doctor
 * Strange's INVOCATION cards together (Crimson Bands of Cyttorak, Images of Ikonn, Seven Rings of Raggadorr, Vapors
 * of Valtorr, and Winds of Watoomb). Then, place the INVOCATION deck facedown next to your identity card. During the
 * game, play with the top card of the INVOCATION deck faceup at all times. You may use Doctor Strange's 'Spell
 * Mastery' action to resolve the ability on that card. After that card is resolved, it is placed in a special
 * discard pile that belongs to the INVOCATION deck. If the INVOCATION deck is ever empty, shuffle the INVOCATION
 * discard pile back into the INVOCATION deck. There is no penalty for doing this."
 *
 * Its contents are fixed by the identity, not chosen during deckbuilding, so they are data here and never part of
 * a `Deck`. Each listed card carries `separateDeck` equal to `name`.
 */
export interface IdentitySeparateDeck {
  /** The deck's name, matching `separateDeck` on each of its cards ("Invocation"). */
  readonly name: string;
  /** Every card in the deck, by quantity. */
  readonly cards: readonly { readonly cardId: CardId; readonly quantity: number }[];
  /** "play with the top card of the [...] deck faceup at all times". */
  readonly topCardFaceup: boolean;
  /**
   * `"own"`: "a special discard pile that belongs to the [...] deck", separate from the owner's discard pile (Doctor
   * Strange). `"none"`: its cards can never enter a discard pile at all (Hercules, below).
   */
  readonly discardPile: "own" | "none";
  /**
   * `"reshuffleDiscardWithoutPenalty"`: "If the [...] deck is ever empty, shuffle the [...] discard pile back into the
   * [...] deck. There is no penalty for doing this." (Doctor Strange.) `"stayEmpty"`: an empty deck stays empty, with
   * no penalty; nothing refills it (Hercules — a 3-card deck whose cards never reach a discard pile).
   */
  readonly whenEmpty: "reshuffleDiscardWithoutPenalty" | "stayEmpty";
  /**
   * Which kind of card the deck holds (docs/phase7-wave2.md §15). Absent means `"player"` — every deck before
   * Hercules — so existing data is unchanged.
   *
   * `"encounter"`: the Hercules Hero Pack insert, "The Gift and Labor Decks": "he begins each game with two special
   * 3-card decks. To create the GIFT and LABOR decks, shuffle the three GIFT cards together to form the GIFT deck and
   * the three LABOR cards to form the LABOR deck. Then, place both of these decks facedown in your play area." Its
   * "Alternate Player & Encounter Card Backs" section: the pack's "variation on the standard player and encounter card
   * backs" exists because "the rules for these cards prevent them from entering a deck, a discard pile, or a player's
   * hand". The Labor cards (Defeat the Hydra, Embody Pathos, Protect Humanity) are the encounter-backed ones — typed
   * attachment/obligation, "Victory 0." — and each carries `EncounterCardCommon.separateDeck`. The Gift deck is a
   * `"player"` deck of Permanent upgrades.
   *
   * **Data only.** The engine builds `"player"` decks with `discardPile: "own"` (Doctor Strange) and refuses to seat
   * an identity with any other kind (`createGame`), since building one as if it were Doctor Strange's would play a
   * different game.
   */
  readonly cardFamily?: "player" | "encounter";
}
