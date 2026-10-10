import type { AnyCard, CardId, Trait, VillainSideLetter } from "@mc/content";
import type { CampaignGameInput, CampaignInGameWrites, CampaignWindow } from "./campaign.js";
import type { EncounterDeckId, FrameId, GameAreaId, InstanceId, PlayerId } from "./ids.js";
import type { PendingChoice } from "./choices.js";
import type { OutsideFacts } from "./outside-facts.js";
import type { RngState } from "./rng.js";
import type { StackFrame } from "./stack.js";
import type { LastingEffect } from "./lasting.js";
import type { RuleSpec } from "./abilities.js";
import type { EffectSpec, StatusName } from "./spec.js";
import type { EncounterDealSource, LeaveCauseSide, TriggerEvent } from "./trigger-events.js";

export type Form = "hero" | "alterEgo";

/**
 * Cards to put on top of a deck after setup's shuffle, top card first (`GameState.setupStack`). Each code takes one
 * copy of that card, the topmost copy after the shuffle; `encounter` is the first encounter deck (`encounterDeckOrder[0]`).
 */
export interface StackedDecks {
  readonly players?: Readonly<Record<string, readonly CardId[]>>;
  readonly encounter?: readonly CardId[];
}

/** RRG "Status Cards": a character can hold at most one of each type (steady allows a second). */
export interface StatusCounts {
  readonly stunned: number;
  readonly confused: number;
  readonly tough: number;
}

export const NO_STATUSES: StatusCounts = { stunned: 0, confused: 0, tough: 0 };

/** Every status card type in the game, in RRG 1.8 "Status Cards" (p. 42) order. */
export const STATUS_NAMES = ["confused", "stunned", "tough"] as const satisfies readonly (keyof StatusCounts)[];

/**
 * Every zone a card instance can occupy, as data. `attachment` and `boost` are
 * per-instance lists (attachments/boost cards hang off the card they're on),
 * which is why they name a host instance instead of a player or a global pile.
 */
export type ZoneId =
  | { readonly kind: "hand"; readonly playerId: PlayerId }
  | { readonly kind: "deck"; readonly playerId: PlayerId }
  | { readonly kind: "discard"; readonly playerId: PlayerId }
  | { readonly kind: "playArea"; readonly playerId: PlayerId }
  | { readonly kind: "dealtEncounter"; readonly playerId: PlayerId }
  /** Event cards being played: out of play while they resolve (RRG "Event"), then discarded. */
  | { readonly kind: "resolving"; readonly playerId: PlayerId }
  /** A player's set-aside nemesis encounter set (RRG "Nemesis Encounter Set"): out of play. */
  | { readonly kind: "setAside"; readonly playerId: PlayerId }
  /** Cards tucked under another card (RRG "Tuck"): out of play, discarded when the host leaves play. */
  | { readonly kind: "tucked"; readonly hostInstanceId: InstanceId }
  | { readonly kind: "identity"; readonly playerId: PlayerId }
  | { readonly kind: "encounterDeck"; readonly deckId: EncounterDeckId }
  | { readonly kind: "encounterDiscard"; readonly deckId: EncounterDeckId }
  /**
   * Scenario cards set aside at setup (RRG 1.8 "Set Aside", p. 39): out of play until an ability brings them in.
   * The Wrecking Crew's signature side schemes wait here for Breakout 1A's "Put … side schemes into play".
   */
  | { readonly kind: "encounterSetAside" }
  /**
   * An identity's separate deck and that deck's own discard pile (the Invocation deck; docs/phase7-wave1.md §3.5).
   * Out of play, owned by that player (RRG 1.8 "Ownership and Control", p. 31).
   */
  | { readonly kind: "separateDeck"; readonly playerId: PlayerId; readonly name: string }
  | { readonly kind: "separateDiscard"; readonly playerId: PlayerId; readonly name: string }
  /**
   * A scenario's own separate deck and its discard pile (docs/phase7-wave2.md §3.3; `Scenario.separateDecks`): the
   * Experimental Weapons deck, the side-scheme deck. Out of play, owned by nobody.
   */
  | { readonly kind: "scenarioDeck"; readonly name: string }
  | { readonly kind: "scenarioDiscard"; readonly name: string }
  /**
   * A scenario's own out-of-play game area (docs/phase7-wave3.md §3.14): Infiltrate the Museum's The Collection, "an
   * out-of-play game area shared by all players and specific to this scenario. Cards in The Collection follow the
   * standard rules for out-of-play cards" (MC16 p. 10). Created by the scenario's setup (`createScenarioArea`).
   */
  | { readonly kind: "scenarioArea"; readonly name: string }
  /**
   * A scenario's own game area that is in play and under no player's control (docs/phase7-wave8.md §3.33): the mission
   * area of MC45 p. 5, "Cards in the mission area are in play but under no player's control." The in-play sibling of
   * `scenarioArea`; encounter cards and player cards share it. Created by `createScenarioPlayArea`
   * (`GameState.scenarioPlayAreas`).
   */
  | { readonly kind: "scenarioPlayArea"; readonly name: string }
  | { readonly kind: "villainArea" }
  | { readonly kind: "attachment"; readonly hostInstanceId: InstanceId }
  | { readonly kind: "boost"; readonly hostInstanceId: InstanceId }
  | { readonly kind: "victoryDisplay" }
  | { readonly kind: "removedFromGame" };

/**
 * One in-play scenario area (`ZoneId scenarioPlayArea`, docs/phase7-wave8.md §3.33). A card in it is in play, keeps its
 * owner, and has no controller and no engaged player; a card attached to one of them is in the area with its host.
 */
export interface ScenarioPlayAreaState {
  /** The unattached cards in the area, in the order they entered it. */
  readonly cards: readonly InstanceId[];
  /**
   * MC45 p. 5: "They cannot be affected by card abilities unless the ability refers to the mission area." A closed
   * area's cards are skipped by every query and selector of an ability that does not name the area
   * (`TargetQuery.inScenarioPlayArea`, `AbilityDefinition.reaches`).
   */
  readonly closed: boolean;
}

/**
 * What a facedown card in play is treated as ("put the top card of your deck
 * into play facedown, engaged with you as a Drone minion"): a minion with only
 * these traits, no name, no keywords and no abilities of its own, and printed
 * base stats of 0 (card abilities can set its base stats).
 *
 * `blank` is a card that is in play facedown as nothing in particular — "attach 1 card from your hand facedown here"
 * (Bruno Carrelli). It has no title, traits, keywords or abilities while it is facedown; its card type is unchanged,
 * because nothing asks what type a facedown attachment is (docs/phase7-wave1.md §3.13).
 */
export interface FacedownRole {
  readonly kind: "minion" | "blank";
  readonly traits: readonly Trait[];
}

/**
 * A faceup ally treated as a minion by an attachment on it (Fallen Warrior, Beguiled, `mts` 21153, 21178: "Treat
 * attached ally as an [Undead] minion with a blank text box. Attached minion's SCH is equal to its printed THW and it
 * does not take consequential damage."; docs/phase7-wave4.md §3.9). Ruling, Dec 17, 2025 (1) #3: "the ally does not
 * leave play and the 'minion' does not enter play; the character remains in play and retains all tokens and
 * attachments. (The process is essentially a status change.)" Kept on the instance, set and cleared as the attachment
 * arrives and goes (`syncTreatedAs`), so every "is this a minion?" reader answers from state alone. While it is set the
 * card is a minion, enemy and character, not an ally; its text box is blank; its traits are `traits` (plus its printed
 * ones when `keepPrintedTraits`, "a blank text box (except for traits)"); its SCH is its printed THW when `schFromThw`.
 * `controllerBefore` is who controlled it as an ally, who gets it back when the attachment goes.
 */
export type TreatedAs = TreatedAsMinion | TreatedAsAlly;

export interface TreatedAsMinion {
  readonly kind: "minion";
  readonly traits: readonly Trait[];
  readonly keepPrintedTraits: boolean;
  /** `"current"`: "SCH is equal to its THW", the ally's THW with its modifiers, not the printed value (wave 7 §3.44). */
  readonly schFromThw: boolean | "current";
  readonly source: InstanceId;
  readonly controllerBefore: PlayerId | null;
}

/**
 * The mirror (docs/phase7-wave4.md §3.29): a minion a player takes control of and treats as an ally — "Take control of
 * attached minion and treat it as a [Controlled] ally with a blank text box. Its THW is equal to its printed SCH and it
 * takes 1 consequential damage after it thwarts or attacks." (Mind Control, `phoenix` 34009; Redemption, `bp` 51036,
 * [Redeemed]); Karma (`rogue` 38011, "While Karma is in play", 2 consequential damage). While set the card is an ally
 * and character that `controller` controls, not a minion or an enemy; its text box is blank; its traits are `traits`;
 * its THW is its printed SCH when `thwFromSch` and its ATK its printed ATK; it takes `consequential` damage after it
 * attacks or thwarts. `source` is the attachment or the card whose effect did it; when that is gone it is a minion
 * again, engaged with the player who controlled it (§4 Q21). `engagedBefore` is who it was engaged with.
 */
export interface TreatedAsAlly {
  readonly kind: "ally";
  readonly traits: readonly Trait[];
  readonly thwFromSch: boolean;
  readonly consequential: number;
  readonly source: InstanceId;
  readonly controller: PlayerId;
  readonly engagedBefore: PlayerId | null;
}

/**
 * Where "discard" sends a card, fixed when the card is created (docs/phase7-wave1.md §3.2).
 *
 * - `player`: its owner's discard pile.
 * - `encounterDeck`: that encounter deck's discard pile. The Wrecking Crew insert, "Multiple Villains and
 *   Encounter Decks": "When an encounter card leaves play, it is placed in the discard pile of its corresponding
 *   encounter deck."
 * - `activeEncounterDeck`: a card with no encounter deck of its own (an obligation, a nemesis set card) goes to
 *   the active villain's discard pile. Ruling, Jan 17, 2026 (5): "once defeated, it is placed in the active
 *   villain's encounter discard pile."
 *
 * - `separateDeck`: its owner's separate deck of that name (the Invocation deck, §3.5). The Doctor Strange insert:
 *   "After that card is resolved, it is placed in a special discard pile that belongs to the INVOCATION deck."
 *
 * With one villain every encounter home is the same deck, so Core behaves exactly as before.
 */
export type CardHome =
  | { readonly kind: "player" }
  | { readonly kind: "encounterDeck"; readonly deckId: EncounterDeckId }
  | { readonly kind: "activeEncounterDeck" }
  | { readonly kind: "separateDeck"; readonly name: string }
  /**
   * A card of a scenario deck with a discard pile of its own (the side-scheme deck; docs/phase7-wave2.md §3.3) or with
   * none (the show deck; docs/phase7-wave6.md §3.66).
   */
  | { readonly kind: "scenarioDeck"; readonly name: string };

export interface CardInstance {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  /** Player whose deck it came from; null for encounter/scenario cards. */
  readonly ownerId: PlayerId | null;
  readonly controllerId: PlayerId | null;
  /** Where "discard" sends this card (see `CardHome`). */
  readonly home: CardHome;
  readonly faceup: boolean;
  readonly exhausted: boolean;
  readonly damage: number;
  readonly threat: number;
  readonly statuses: StatusCounts;
  readonly counters: Readonly<Record<string, number>>;
  readonly attachedTo: InstanceId | null;
  readonly attachments: readonly InstanceId[];
  /** Facedown boost cards given to this enemy for an activation (RRG "Boost"). */
  readonly boostCards: readonly InstanceId[];
  /** Cards tucked under this card (RRG "Tuck"; Highway Robbery's facedown cards). Not in play. */
  readonly tucked: readonly InstanceId[];
  /** Set while this card is in play facedown as something else (a facedown Drone minion). */
  readonly facedownAs: FacedownRole | null;
  /** Absent or null on every card not treated as another card type (docs/phase7-wave4.md §3.9). */
  readonly treatedAs?: TreatedAs | null;
  readonly engagedWith: PlayerId | null;
  /**
   * A double-sided encounter card showing its other face (`EncounterCardCommon.flipSide`; RRG 1.8 "Flip", p. 20).
   * A villain's face is `VillainState.side` instead. Always false out of play.
   */
  readonly flipped: boolean;
  /**
   * A copy of a main scheme fixed at one stage, out of play: "Add this card / this scheme to the victory display" (The
   * Brotherhood Strikes! 1B and its stage 2Bs, `mut_gen` 32125b–32129b; `EffectSpec addMainSchemeStageToVictoryDisplay`,
   * docs/phase7-wave6.md §3.19). Its name, traits and keywords are that stage's. Absent on every other instance,
   * including the main scheme in play, whose stage is its `MainSchemeState.stageIndex`.
   */
  readonly mainSchemeStageIndex?: number;
  /**
   * Damage this character has taken this phase, kept only while a `maxDamageTakenPerAttack` rule with `per: "phase"`
   * applies to it ("Nimrod cannot take more than 3 damage each phase", docs/phase7-wave6.md §3.4). Removed at every
   * phase boundary (where `playedThisPhase` is emptied) and absent on every other instance, so their serialized state
   * is unchanged.
   */
  readonly damageTakenThisPhase?: number;
  /**
   * A facedown encounter card dealt to a player straight off an encounter deck (villain phase step 3, surge, a player
   * deck reset), so its reveal is "revealed from the encounter deck" (docs/phase7-wave6.md §3.64, §4 Q35). Kept by
   * `relocateCard` while the card sits in a player's dealt encounter cards; absent everywhere else, including on a
   * card dealt from the set-aside area or a boost pile.
   */
  readonly dealtFromEncounterDeck?: true;
}

export interface IdentityState {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  readonly form: Form;
  /**
   * Which hero face is up while in hero form: 0 is the identity's `hero`, n is `additionalHeroForms[n - 1]` (a
   * three-sided identity's inside face; docs/phase7-wave2.md §3.2). Null in alter-ego form. `form` is kept beside it so
   * every reader that only asks "hero or alter-ego" is unchanged.
   */
  readonly heroFormIndex: number | null;
  /** RRG "Form, Change Form": once each round, during that player's own turn. */
  readonly changedFormThisRound: boolean;
  /**
   * A separated identity's other physical card (`HeroIdentityCard.separatedIdentity`; docs/phase7-wave5.md §3.24): the
   * hero card's support side in the play area in alter-ego form, the alter-ego card's upgrade side attached to the
   * identity in hero form, set aside until setup step 16 puts it into play (`separated-identity.ts`). Absent for every
   * other identity, so their serialized state is unchanged.
   */
  readonly separatedCardInstanceId?: InstanceId;
}

export interface PlayerState {
  readonly playerId: PlayerId;
  /** Seat order around the table; "clockwise" is ascending seatIndex, wrapping. */
  readonly seatIndex: number;
  readonly identity: IdentityState;
  readonly hand: readonly InstanceId[];
  readonly deck: readonly InstanceId[];
  readonly discard: readonly InstanceId[];
  readonly playArea: readonly InstanceId[];
  /** Facedown encounter cards dealt in villain phase step 3, revealed in step 4. */
  readonly dealtEncounter: readonly InstanceId[];
  /** Event cards this player is playing right now (out of play until discarded). */
  readonly resolving: readonly InstanceId[];
  /** This player's set-aside nemesis set (Shadow of the Past brings it in). */
  readonly setAside: readonly InstanceId[];
  /**
   * Decks this player's identity brings besides the player deck, by name (`HeroIdentityCard.separateDecks`; the
   * Invocation deck). Built and shuffled at setup; empty for every Core identity.
   */
  readonly separateDecks: Readonly<Record<string, SeparateDeckState>>;
  readonly eliminated: boolean;
  /**
   * Mulligans this player may take after the first at setup (`PlayerSetup.extraMulligans`; docs/phase7-wave5.md
   * §3.26). A setup input that never changes; absent when 0. The count taken so far lives on the mulligan step.
   */
  readonly extraMulligans?: number;
  /**
   * Cards this player already holds that count toward their starting hand (`EffectSpec countTowardStartingHand`;
   * docs/phase7-wave8.md §3.44): the draw of RRG 1.8 Appendix II step 14 is that much smaller, and clears it. Absent
   * when 0, which is every game no earlier setup instruction credited.
   */
  readonly startingHandCredit?: number;
  /**
   * Facts from outside the game this seat supplied at setup (`PlayerSetup.outsideFacts`; docs/phase7-wave7.md §3.83),
   * read by `Predicate outsideFact`. A setup input that never changes; absent when the seat supplied none that is
   * true.
   */
  readonly outsideFacts?: OutsideFacts;
}

/**
 * One separate deck and its own discard pile (docs/phase7-wave1.md §3.5). The top card's `faceup` follows the
 * identity's `topCardFaceup` after every change (`syncSeparateDeckTop`); a deck that empties with cards in its discard is
 * reshuffled at once, by the move that emptied it, with no penalty (`resetSeparateDeckIfEmpty`).
 */
export interface SeparateDeckState {
  readonly deck: readonly InstanceId[];
  readonly discard: readonly InstanceId[];
}

export interface VillainState {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  /** The face up: A or B, or C on the inside of a three-sided villain (`VillainSideLetter`). */
  readonly side: VillainSideLetter;
  readonly stageIndex: number;
  /** The last stage used this game (standard I–II, expert II–III): defeating it defeats this villain. */
  readonly lastStageIndex: number;
  /**
   * The last stage has been defeated. RRG 1.8 "Villain Defeat" (p. 47): the stage is removed from the game, so a
   * defeated villain is out of play. With several villains the game goes on until every one is defeated.
   */
  readonly defeated: boolean;
  /** This villain's own encounter deck (every villain of a single-deck scenario shares the one deck). */
  readonly encounterDeckId: EncounterDeckId;
  /**
   * This villain's signature side scheme (The Wrecking Crew insert, "Signature Side Schemes"), or null. The link
   * holds whether the scheme is set aside, in play, or removed from the game.
   */
  readonly signatureSideSchemeId: InstanceId | null;
}

/**
 * One scenario deck and its discard pile, with the rules its `ScenarioSeparateDeck` states (docs/phase7-wave2.md §3.3).
 * `discardPile: "encounter"` cards keep an encounter-deck home, so a discard goes to the encounter discard pile ("After a
 * card from the Experimental Weapons deck enters play, it is considered to be part of the encounter deck"); `"own"` cards
 * are homed to this deck and go to its discard pile.
 *
 * `discardPile: "none"` (the show deck, MojoMania insert p. 11: "The show deck has no discard pile"; docs/phase7-wave6.md
 * §3.66): `discard` stays empty for the whole game. Its cards are homed to the deck and print where they go when
 * discarded (Across the Mojoverse 1B's replacement, Cornered!'s own text); one discarded with no replacement applying
 * goes to the encounter discard pile (`discardZoneFor`; the owner's decision, 2026-10-03, §4.1 Q54).
 */
export interface ScenarioDeckState {
  readonly deck: readonly InstanceId[];
  readonly discard: readonly InstanceId[];
  readonly discardPile: "own" | "encounter" | "none";
  readonly whenEmpty: "reshuffleDiscardWithoutPenalty" | "remainsEmpty";
  /** Which encounter-deck cards form it (`ScenarioSeparateDeck.contents`); read by `buildScenarioDeck`. */
  readonly contents: {
    readonly encounterSetIds?: readonly string[];
    readonly cardType?: "side_scheme" | "environment";
    /** Only cards printing this trait (the Infinity Stones; docs/phase7-wave4.md §1.10). */
    readonly trait?: string;
    /** Cards that join by id besides the ones the other fields match (Cornered! in the show deck; wave 6 §3.66). */
    readonly cardIds?: readonly string[];
  };
  /**
   * `ScenarioSeparateDeck.closedToPlayerCards` (the show deck "cannot be affected by player card effects", MojoMania
   * insert p. 11): a player card's ability never selects, looks at, reorders or moves a card in this deck, nor puts one
   * into it (`closedToPlayerCard`). docs/phase7-wave6.md §3.66.
   */
  readonly closedToPlayerCards?: true;
  /**
   * Built from the encounter deck during scenario setup, with no card text asking: a deck an encounter set brings to any
   * game it is in (`EncounterSet.separateDecks`, the Infinity Stone deck; MC21 p. 16). docs/phase7-wave4.md §3.6.
   */
  readonly buildAtSetup?: true;
}

/** A tucked card that was discarded, waiting to be announced: the fields of `TriggerEvent tuckedCardDiscarded`. */
export type TuckedDiscard = Omit<Extract<TriggerEvent, { kind: "tuckedCardDiscarded" }>, "kind">;

/** A facedown encounter card dealt to a player, waiting to be announced (`TriggerEvent encounterCardDealt`). */
export interface DealtEncounterCard {
  readonly playerId: PlayerId;
  readonly instanceId: InstanceId;
  readonly source: EncounterDealSource;
}

/** A card that entered a player's hand, waiting to be announced (`TriggerEvent cardEntersHand`, wave 6 §3.10). */
export interface EnteredHand {
  readonly playerId: PlayerId;
  readonly instanceId: InstanceId;
  readonly from: ZoneId["kind"] | null;
}

/**
 * An encounter card that left a player's deck, drawn or discarded, waiting to be announced between frames (`TriggerEvent
 * encounterCardFromPlayerDeck`, docs/phase7-wave5.md §3.5).
 */
export interface EncounterFromDeck {
  readonly playerId: PlayerId;
  readonly instanceId: InstanceId;
  readonly how: "draw" | "discard";
}

/**
 * A card discarded from a player's deck (`TriggerEvent cardDiscardedFromDeck`, docs/phase7-wave7.md §3.55), whose
 * fields these are. `boundOn`: the discarding ability's set of the cards "discarded this way", as the slot `slot` of
 * frame `frameId` (the effects frame of a `moveCards` or `discardDeckUntil` with a `bind`, the frame a
 * `discardFromDeckSlot` cost was paid for), which drops the card if a response takes it away (§4.1 Q32,
 * `settleDeckDiscards`). `also`: further slots of that frame holding the card (`discardDeckUntil.bindAll`,
 * docs/phase7-wave8.md §3.71), which drop it the same way.
 */
export interface DeckDiscard {
  readonly playerId: PlayerId;
  readonly instanceId: InstanceId;
  readonly sourceInstanceId: InstanceId | null;
  readonly at: "discard" | "deck";
  readonly boundOn?: { readonly frameId: FrameId; readonly slot: string; readonly also?: readonly string[] };
}

/**
 * The deck discards one response window answers: `frameId` is the event frame that opens the window (the last of the
 * batch, `pushEventsSharingResponses`). Once that frame has left the stack every response has resolved, and each card
 * a response took away is dropped from its `boundOn` frame's bound sets (`settleDeckDiscards`).
 */
export interface DeckDiscardWindow {
  readonly frameId: FrameId;
  readonly discards: readonly DeckDiscard[];
}

/**
 * A status card placed on a character, waiting to be announced (`TriggerEvent statusPlaced`, docs/phase7-wave7.md
 * §3.27); the fields are that event's.
 */
export interface StatusPlaced {
  readonly instanceId: InstanceId;
  readonly status: StatusName;
  readonly sourceInstanceId: InstanceId | null;
  readonly playerId: PlayerId | null;
}

/**
 * A card that left play, as it was while still in play, waiting to be announced (`TriggerEvent cardLeavesPlay`,
 * docs/phase7-wave5.md §3.13).
 */
export interface LeftPlay {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  readonly controllerId: PlayerId | null;
  /** The player an uncontrolled card's "you" named while in play (`TriggerEvent cardLeavesPlay.speakerId`). */
  readonly speakerId?: PlayerId;
  readonly to: ZoneId["kind"];
  readonly traits: readonly Trait[];
  /** The attachments its leaving left in play, unattached (`TriggerEvent cardLeavesPlay.strandedAttachments`). */
  readonly strandedAttachments?: readonly InstanceId[];
  /** Whose card effect moved it (`TriggerEvent cardLeavesPlay.by`); absent for a game rule or a cost. */
  readonly by?: LeaveCauseSide;
  /** It left during its own leaving's interrupt window (a replacement's move): only responses (§4.1 Q17). */
  readonly interruptsResolved?: true;
}

/** A deck that ran out, waiting to be announced between frames (`TriggerEvent deckRanOut`, docs/phase7-wave4.md §3.11). */
export type DeckRunOut =
  | { readonly deck: "player"; readonly playerId: PlayerId }
  | { readonly deck: "scenario"; readonly name: string }
  /** An encounter deck that was reset (docs/phase7-wave6.md §3.60). */
  | { readonly deck: "encounter"; readonly deckId: EncounterDeckId };

/** One encounter deck and its discard pile (RRG 1.8 "Encounter Deck", p. 17). */
export interface EncounterDeckState {
  readonly deck: readonly InstanceId[];
  readonly discard: readonly InstanceId[];
}

/**
 * What made a main scheme advance to the stage now showing (docs/phase7-wave7.md §3.12), for a stage that asks: "If
 * the previous stage was advanced by knock counters, …".
 *
 * - `completed`: the previous stage was completed and the game advanced it (RRG 1.8 "Main Scheme", p. 27): its threat
 *   reached the target, or a card declared it complete (`EffectSpec completeMainScheme`). `sourceInstanceId` is null: no
 *   card advanced it, whichever cards placed the threat.
 * - `cardEffect`: a card ability's `advanceMainScheme` ("advance to stage 2A"), which is not a completion.
 *   `sourceInstanceId` is the card the ability is on, the scheme itself for its own text, or null if it has none.
 */
export interface MainSchemeAdvancedBy {
  readonly cause: "completed" | "cardEffect";
  readonly sourceInstanceId: InstanceId | null;
}

export interface MainSchemeState {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  readonly stageIndex: number;
  readonly completed: boolean;
  /** RRG "Acceleration Token": carries over when the main scheme advances. */
  readonly accelerationTokens: number;
  /**
   * The order its stages are walked in, as stage indexes, once a card has shuffled them ("Shuffle all copies of main
   * scheme 2A and stack them under this scheme", The Brotherhood Strikes! 1A; `EffectSpec shuffleMainSchemeStages`,
   * docs/phase7-wave6.md §3.18). When present it is the authority for the default advance: the next stage is the entry
   * after the current one, and the last entry is the final stage. Absent, stages are walked in printed order (and a
   * group of same-numbered alternatives needs card text to pick one, Kang's stage 3).
   */
  readonly stageOrder?: readonly number[];
  /**
   * What advanced this scheme to its current stage, replaced on every advance (`Predicate mainSchemeAdvancedBy`).
   * Absent until the scheme first advances, and in a game saved before the field existed: the cause is then unknown and
   * the predicate is false for every cause.
   */
  readonly advancedBy?: MainSchemeAdvancedBy;
  /**
   * Present while this stage's A side is the faceup one (docs/phase7-wave8.md §4.1 Q56): from setup until Appendix II
   * step 12b flips 1A to 1B, and from an advance until its step 3 flips the new stage (RRG 1.8 pp. 51, 27). The B
   * side's abilities are not live until then (`activeAbilityRefs`); the A side's Setup and When Revealed abilities are
   * resolved by the frames pushed for them. Removed by the `mainSchemeTurnsToB` event. Absent: the B side is faceup.
   */
  readonly faceupSide?: "A";
}

/**
 * One separate game area (docs/phase7-wave2.md §3.1; The Once and Future Kang insert, "Playing With Separate Game
 * Areas"). Created by a card ability ("Create your own game area and place this scheme in it"), never at setup.
 *
 * - `playerIds`: the players in it. A player's own cards (identity, play area, engaged minions and their attachments)
 *   are in their area.
 * - `mainScheme`: the area's own main scheme stage, an instance of the scenario's main scheme card at one of its
 *   alternative stages (Kang's stage 3), or null once a card has removed it ("Remove the Chronopolis from the game").
 * - `villainIds` / `activeVillainId`: the villains in it ("Add Kang (Immortus) to the game area"); "the villain" in this
 *   area is `activeVillainId`.
 * - `sideSchemeIds`: side schemes that belong to it (in the shared `villainArea` zone like every side scheme).
 *
 * Everything else in play, environments above all (RRG 1.8 FAQ "The Once and Future Kang Scenario Pack", p. 60:
 * "Environment cards are considered to be in all players' game areas"), and the central stage (`GameState.mainScheme`,
 * "Stage 2B remains in play in a central location and its text remains active for all players") is in every area.
 */
export interface GameAreaState {
  readonly areaId: GameAreaId;
  readonly playerIds: readonly PlayerId[];
  readonly mainScheme: MainSchemeState | null;
  readonly villainIds: readonly InstanceId[];
  readonly activeVillainId: InstanceId | null;
  readonly sideSchemeIds: readonly InstanceId[];
  /** Stages this area had and a card removed ("Remove the Chronopolis from the game"), so their text still knows its area. */
  readonly formerSchemeIds: readonly InstanceId[];
}

/**
 * Scenario rules the engine applies itself, fixed at setup from the scenario data (`GameSetupConfig`).
 *
 * - `victory`: `"finalVillainStage"` is RRG 1.8 "Villain Defeat" (p. 47); `"cardAbility"` means only an ability wins
 *   (`winGame`; Kang (III): "When Defeated: The players win the game."), so defeating every villain does not
 *   (docs/phase7-wave2.md §1.8, §3.4).
 * - `separateGameAreas`: whether card abilities may split the players into areas (`Scenario.separateGameAreas`).
 */
export interface ScenarioRules {
  readonly victory: "finalVillainStage" | "cardAbility";
  readonly separateGameAreas: boolean;
  /**
   * Where the active counter goes when the villain holding it is defeated. Absent: The Wrecking Crew insert's rule (the
   * villain whose side scheme has the most threat). `nextInActivationOrder`: The Sinister Six, MC27 p. 15, "After the
   * villain with the active counter is defeated, move the active counter to the next villain in the activation order.
   * If no other villains are in play, set the active counter aside." It also turns on the FAQ (RRG 1.8 p. 62): a
   * villain activating while none in play has the counter gives it to the lowest activation order value.
   * docs/phase7-wave5.md §3.1.
   */
  readonly activeCounter?: "nextInActivationOrder";
  /** `GameSetupConfig.victoryCondition` (Loki's count; docs/phase7-wave4.md §3.7). Absent in every other game. */
  readonly victoryCondition?: number;
  /**
   * `GameSetupConfig.difficulty`: `"expert"` in expert mode; absent in standard mode, so every older save reads as
   * standard. Read by the mode-only faces rule (`modeOnlyFlipped`; docs/phase7-wave4.md §3.18).
   */
  readonly difficulty?: "expert";
  /** `GameSetupConfig.scenarioRuleSpecs`: rules the scenario imposes without a card (docs/phase7-wave4.md §3.40). */
  readonly rules?: readonly RuleSpec[];
  /**
   * `GameSetupConfig.scenarioSetupInstructions`: setup text a rulebook prints rather than a card (Tower Defense's
   * optional setup damage, MC21 p. 11; docs/phase7-wave4.md §4 Q4). Absent in every game that has none, so an older
   * save reads unchanged.
   */
  readonly setupInstructions?: readonly ScenarioSetupInstruction[];
  /**
   * `GameSetupConfig.setupOptions`: the optional setup rules the players turned on, each with the amount they stated
   * (`SetupOption`; docs/phase7-wave8.md §3.5). Absent in every game that states none, so an older save reads
   * unchanged.
   */
  readonly setupOptions?: readonly SetupOption[];
  /**
   * `GameSetupConfig.setAsideUntilCalled`: cards RRG 1.8 Appendix II step 11 (p. 51) leaves in the set-aside area
   * although they have the setup keyword. Absent in every game without such a scenario rule.
   */
  readonly setAsideUntilCalled?: SetAsideUntilCalled;
}

/**
 * Cards a scenario's own printed text sets aside and brings in later, so their setup keyword does not put them into
 * play at RRG 1.8 Appendix II step 11 (p. 51). Step 11 reads "Search each deck and the set aside area for any cards
 * with the setup keyword and put them into play", and a scenario may say otherwise for its own cards: MC40 p. 16, "The
 * setup keyword on the Flight, Super Strength, and Telepathy attachments is ignored in this scenario because these
 * cards are set aside during setup" (docs/phase7-wave7.md §4.1 Q20; docs/setup-keyword-set-aside-audit.md). A card is
 * named by its id or by an encounter set it belongs to (`encounterSetIds`, or `specificTo`'s set for a player-typed
 * scenario card). Only the encounter set-aside area is read against it; a deck's cards and a player's own set-aside
 * cards are never held back.
 */
export interface SetAsideUntilCalled {
  readonly cardIds?: readonly CardId[];
  readonly encounterSetIds?: readonly string[];
}

/**
 * One setup instruction a scenario's rulebook prints rather than a card: resolved once, after RRG 1.8 Appendix II
 * step 12's card abilities (the main scheme's and villains' Setup and When Revealed, including everything they put
 * into play) and before step 14's draw. Plain data, like a campaign instruction, so it is part of the replay baseline.
 * `text` and `citation` are copied into the `scenarioSetupInstructionResolved` event so the log reads on its own.
 */
export interface ScenarioSetupInstruction {
  readonly id: string;
  readonly text: string;
  readonly citation: string;
  readonly effects: readonly EffectSpec[];
}

/**
 * One optional setup rule the players turned on, with the amount they stated: a rule an encounter set's or a scenario's
 * rulebook offers "up to the players as a group" (MC45 p. 8, "Modular Difficulty": "they may place threat on Gene Pool
 * during setup … The amount of threat placed is up to the players as a group"; docs/phase7-wave8.md §3.5, §4.1 Q1).
 *
 * Resolved once, after RRG 1.8 Appendix II step 11 (the setup-keyword cards are in play) and before step 12's Setup
 * and When Revealed abilities (p. 51), as scenario text resolved by the first player. `amount` is what the players
 * stated and is what the `setupOptionApplied` log entry records; `effects` is the plain-data instruction the scenario
 * builder wrote for that amount. The engine never fills an amount in from the mode: an option the setup config does
 * not list is not applied. Part of the setup config, so of the replay baseline.
 */
export interface SetupOption {
  /** The option's stable id, chosen by the scenario builder ("<encounter set>.<rule>"). */
  readonly option: string;
  /** The amount the players stated: a whole number, 0 or more. */
  readonly amount: number;
  readonly text: string;
  readonly citation: string;
  readonly effects: readonly EffectSpec[];
}

/**
 * A modular encounter set chosen at setup and set aside rather than shuffled in (`GameSetupConfig.setAsideModularSets`;
 * Making Connections 1A: "Choose 7 modular encounter sets and set them aside"; docs/phase7-wave4.md §3.18). Its cards
 * are in `encounterSetAside`; `instanceIds` names them, so "choose 1 set-aside modular encounter set at random, then
 * shuffle it into the encounter deck" takes exactly that set's cards.
 */
export interface SetAsideModularSet {
  readonly encounterSetId: string;
  readonly instanceIds: readonly InstanceId[];
}

/**
 * Steps that iterate players carry the remaining player order explicitly, so a
 * player being eliminated mid-step can't shift anyone else's place in line.
 */
export type GameStep =
  /**
   * A campaign's own setup instructions for this scenario, at one of RRG Appendix II's five printed windows
   * (`CampaignWindow`, resolved in `CAMPAIGN_WINDOW_ORDER`). **Campaign games only**: a game created without
   * `GameSetupConfig.campaign` never reaches this step or `scenarioSetup`, and its step sequence is unchanged.
   */
  | { readonly phase: "setup"; readonly kind: "campaignWindow"; readonly window: CampaignWindow }
  /**
   * RRG 1.8 Appendix II steps 6-12 (p. 51): shuffle the decks, place starting threat, put setup cards into play,
   * resolve the scenario's own setup abilities. A flow step only in a campaign game, where `beforeScenarioSetup`
   * instructions have to resolve *before* it; otherwise `createGame` runs the same code inline as it always has.
   */
  | { readonly phase: "setup"; readonly kind: "scenarioSetup" }
  /**
   * RRG 1.8 Appendix II step 12c (p. 51), "Resolve any 'Setup' and 'When Revealed' abilities on the villain", for the
   * villains steps 12a and 12b put into play (`GameState.villainsEnteringAtSetup`). Reached only by a game whose
   * villains all started set aside (`GameSetupConfig.villainsStartSetAside`); every other game resolves 12c in the same
   * batch as 12a and 12b, as it always has, and its step sequence is unchanged. docs/phase7-wave7.md §3.42.
   */
  | { readonly phase: "setup"; readonly kind: "villainSetupAbilities" }
  /** RRG Appendix II step 14, after setup cards and setup abilities have resolved. */
  /**
   * The scenario's rulebook-printed setup instructions (`ScenarioRules.setupInstructions`; MC21 p. 11), after Appendix
   * II step 12's abilities have fully resolved and before step 14's draw. Reached only by a game that has some.
   */
  | { readonly phase: "setup"; readonly kind: "scenarioSetupInstructions" }
  | { readonly phase: "setup"; readonly kind: "drawStartingHands" }
  | {
      readonly phase: "setup";
      readonly kind: "mulligan";
      readonly remainingPlayerIds: readonly PlayerId[];
      /**
       * Which pass of mulligans this is: 1 for the pass of first additional mulligans, and so on (docs/phase7-wave5.md
       * §3.26; passes go in player order, §4.1 Q19). Absent on the normal mulligan.
       */
      readonly pass?: number;
      /**
       * Players, in player order, who have decided this pass and will be offered a mulligan in the next one (an
       * additional mulligan left, and this one changed their hand; §4.1 Q20). Absent when none.
       */
      readonly nextPassPlayerIds?: readonly PlayerId[];
    }
  /**
   * RRG 1.8 Appendix II step 16 (p. 51), "Resolve Player Setup Abilities": after the draw (step 14) and the mulligan
   * (step 15). `resolved`: the abilities have been put on the stack and the first round begins once they finish.
   */
  | { readonly phase: "setup"; readonly kind: "playerSetupAbilities"; readonly resolved?: boolean }
  | {
      readonly phase: "player";
      readonly kind: "turn";
      readonly activePlayerId: PlayerId;
      readonly remainingPlayerIds: readonly PlayerId[];
    }
  | { readonly phase: "player"; readonly kind: "endPhaseDiscard"; readonly remainingPlayerIds: readonly PlayerId[] }
  | { readonly phase: "player"; readonly kind: "endPhaseDraw" }
  /**
   * `readied`: step 4's readies are done but put something on the stack (an additional cost to ready, a "would ready"
   * interrupt; docs/phase7-wave4.md §3.19), so step 5 waits for it to resolve.
   */
  | { readonly phase: "player"; readonly kind: "endPhaseReady"; readonly readied?: true }
  /** `placed`: step one's threat has been pushed; the step stays current until it (and its responses) resolve. */
  | { readonly phase: "villain"; readonly kind: "placeThreat"; readonly placed?: boolean }
  | {
      readonly phase: "villain";
      readonly kind: "enemyActivations";
      /** null means "pull the next player off `remainingPlayerIds`". */
      readonly currentPlayerId: PlayerId | null;
      readonly remainingPlayerIds: readonly PlayerId[];
      readonly villainActivated: boolean;
      readonly activatedMinionIds: readonly InstanceId[];
    }
  /**
   * `announced`: the start of step three went on the stack as `villainStepStarting` (docs/phase7-wave6.md §3.61); the
   * step deals once that frame has resolved. Never set when no interrupt listens.
   */
  | {
      readonly phase: "villain";
      readonly kind: "dealEncounterCards";
      readonly announced?: true;
      /**
       * How many of the step's cards have been dealt, set only while the deal is paused for a response to an encounter
       * deck reset it caused ("After the encounter deck resets", Wheel of Genres; RRG 1.8 "Encounter Deck", p. 17;
       * docs/phase7-wave6.md §4.1 Q58). The step deals the rest once that response has resolved.
       */
      readonly dealt?: number;
    }
  | {
      readonly phase: "villain";
      readonly kind: "revealEncounterCards";
      readonly remainingPlayerIds: readonly PlayerId[];
    }
  | { readonly phase: "villain"; readonly kind: "passFirstPlayer" }
  /** `delayedResolved`: "at the end of the round" delayed effects have been fired (RRG "Lasting Effects"). */
  | { readonly phase: "villain"; readonly kind: "endOfRound"; readonly delayedResolved?: boolean }
  | { readonly phase: "gameOver"; readonly kind: "gameOver" };

export type GameOutcome =
  /** The only villain's last stage was defeated (RRG 1.8 "Villain Defeat", p. 47). */
  | { readonly result: "win"; readonly reason: "villainDefeated" }
  /** Several villains, and the last undefeated one fell (The Wrecking Crew insert: "If the players defeat all 4 villains, they win the game!"). */
  | { readonly result: "win"; readonly reason: "allVillainsDefeated" }
  | { readonly result: "loss"; readonly reason: "mainSchemeCompleted" }
  | { readonly result: "loss"; readonly reason: "allPlayersDefeated" }
  /**
   * A card's own text lost the game: "If Odin leaves play, the players lose the game." (`RuleSpec leavingPlayLoses`,
   * docs/phase7-wave4.md §3.8), or a loss a card scripts (`EffectSpec endGame`: The Champion's ratings).
   *
   * `sourceInstanceId` is the card whose text says the players lose, and is always recorded: a card-caused loss with
   * no card named cannot be explained to the player. `causeInstanceId` is the card that met that text's condition,
   * when it is another card: Robert Kelly leaving play under Stalked by Sabretooth's "If Robert Kelly leaves play, the
   * players lose the game." Absent when the source is its own cause (Odin's own rule) or when no single card is.
   */
  | {
      readonly result: "loss";
      readonly reason: "cardAbility";
      readonly sourceInstanceId: InstanceId;
      readonly causeInstanceId?: InstanceId;
    }
  /**
   * An encounter deck and its discard pile were both empty (RRG 1.8 "Encounter Deck", p. 17: "an infinite loop occurs
   * with an infinite number of acceleration tokens … If this happens, the players lose"; `effects.ts`
   * `loseIfEncounterCardsExhausted`).
   */
  | { readonly result: "loss"; readonly reason: "encounterDeckExhausted" }
  /**
   * A player gave up (the `concede` command). A third result kind rather than a widened `loss`: the RRG has no
   * concede rule, so calling a concession a defeat would import a rules meaning the game does not have — and would
   * quietly turn it into a loss in a win/loss record. Readers that only distinguish "win" from "not win" are
   * unaffected; readers that record a result should treat this as played-but-unresolved.
   *
   * It carries a `reason` like every other outcome so `GameOutcome.reason` stays total for the readers that switch
   * on it, plus `byPlayerId` for the seat that gave up.
   */
  | { readonly result: "conceded"; readonly reason: "playerConceded"; readonly byPlayerId: PlayerId };

/** One reveal in `GameState.revealedThisRound`. `phase` is the phase it happened in (a round has one of each). */
export interface RevealRecord {
  readonly instanceId: InstanceId;
  readonly playerId: PlayerId;
  readonly phase: GameStep["phase"];
}

/** One attack in `GameState.attackedThisTurn`: who made it, and the title they were showing when they did. */
export interface AttackRecord {
  readonly attackerInstanceId: InstanceId;
  readonly attackerTitle: string;
}

/** One attack in `GameState.attacksThisTurn` (docs/phase7-wave5.md §3.12). */
export interface AttackThisTurn {
  readonly attackerInstanceId: InstanceId;
  readonly targetInstanceId: InstanceId;
}

/** One entry of `GameState.characterActsThisPhase`: a character, and what it did (docs/phase7-wave7.md §3.36). */
export interface CharacterActThisPhase {
  readonly characterInstanceId: InstanceId;
  readonly did: "attack" | "thwart";
}

/**
 * Options the table chose for this game, outside the scenario and outside FFG's rules (`GameSetupConfig.tableRules`).
 * Every option defaults to off and an option that is off is not stored, so a game without any has no `tableRules`
 * and older saves and replays read unchanged.
 */
export interface TableRules {
  /**
   * "A hero and an ally with the same name can't both be in play" (owner decision, 2026-10-03). FFG's rule is the
   * default: a hero and a same-titled ally with no subtitle do not match (RRG 1.8 "Unique Icon", pp. 45–46; rulings
   * Jan 26, 2026 (4) #7 and Mar 19, 2026 (4), on Valkyrie), so the Valkyrie ally (or Ironheart's) may be played
   * beside its hero. (The Colossus ally is refused beside the Colossus hero by the RRG itself: it prints the subtitle
   * "Piotr Rasputin", the hero's alter-ego title.) With this on, a unique ally with no subtitle also matches an identity whose hero title is its title
   * (`cardsMatch` in `unique.ts`), so it cannot enter play while that identity is in play, in either form. Deck
   * building is not changed: the ally may still be in a deck and spent as a resource.
   */
  readonly sameNameHeroAllyConflict?: boolean;
}

export interface GameState {
  readonly round: number;
  readonly step: GameStep;
  readonly firstPlayerId: PlayerId;
  /** Fixed at setup: per-player scaling ignores later eliminations (RRG "Player Elimination"). */
  readonly startingPlayerCount: number;
  readonly players: readonly PlayerState[];
  /** Every villain of the scenario in printed order, defeated ones included. Single-villain scenarios list one. */
  readonly villains: readonly VillainState[];
  /**
   * The villain with the active counter (The Wrecking Crew insert, "The Active Villain"): the one that activates,
   * the one "the villain" refers to, and whose encounter deck "the encounter deck" is. Scenario state with its own
   * rules rather than an entry in a card's `counters`; changes are logged as `activeVillainChanged`.
   */
  readonly activeVillainId: InstanceId;
  /**
   * The villains in play as they sit on the table, left to right, in a scenario that lays them out in a row (the Four
   * Horsemen, MC45 p. 11: "reveal them in a row from left to right. Place the active counter on the leftmost
   * villain"; docs/phase7-wave8.md §3.7). Explicit state: `villains` stays in printed order, and the row is where each
   * one sits. Set by `EffectSpec addVillain` with `row: "shuffled"` (logged `villainRowSet`); once a row exists, a
   * villain that enters play joins at the right end and one that leaves play (defeated, set aside, removed) leaves the
   * row. A villain at 0 hit points that is not defeated is still in play and keeps its place. Read by
   * `moveActiveCounter { to: "nextInRow" }` (`nextVillainInRow`). Absent in every scenario without a row, so an older
   * save reads unchanged.
   */
  readonly villainRow?: readonly InstanceId[];
  /**
   * The main scheme: with separate game areas, the central stage outside every area (docs/phase7-wave2.md §3.1); each
   * area's own stage is its `GameAreaState.mainScheme`.
   */
  readonly mainScheme: MainSchemeState;
  /**
   * Other stages of the main scheme deck in play at the same time as `mainScheme`, in the same game area: Tower
   * Defense's "Reveal stage 2A and put it into play next to this stage so there are two main schemes and two villains in
   * play" (Under Siege 1A, `mts` 21098a; MC21 p. 10: "Both main schemes are active each round"). Each is a main scheme
   * like the central one — it gains threat in step one, feels acceleration and crisis icons, and can be completed.
   * Absent in every other game, so saves are unchanged. docs/phase7-wave4.md §3.2.
   */
  readonly extraMainSchemes?: readonly MainSchemeState[];
  /** Separate game areas, in creation order. Empty while the players share one game area (every scenario but Kang). */
  readonly gameAreas: readonly GameAreaState[];
  readonly nextGameAreaSeq: number;
  /**
   * Stage indexes of the main scheme card that can no longer be revealed: an alternative stage already revealed, or one
   * removed from the game ("Remove any unused stage 3 schemes from the game", The Master of Time 2A).
   */
  readonly spentMainSchemeStages: readonly number[];
  /**
   * Main scheme stages revealed by `revealMainSchemeStage` whose A side is still resolving, before `createGameArea`
   * places them in an area ("Create your own game area and place this scheme in it"). Not in play.
   */
  readonly revealedMainSchemes: readonly MainSchemeState[];
  readonly scenarioRules: ScenarioRules;
  /** The table's own options (`TableRules`). Absent when none is on. */
  readonly tableRules?: TableRules;
  /** Every encounter deck with its discard pile, keyed by id. `encounterDeckOrder` gives their stable order. */
  readonly encounterDecks: Readonly<Record<string, EncounterDeckState>>;
  readonly encounterDeckOrder: readonly EncounterDeckId[];
  readonly encounterSetAside: readonly InstanceId[];
  /**
   * The modular sets still set aside, in the order chosen (`SetAsideModularSet`). Absent in a game that set none aside,
   * so its save is unchanged; an empty list once the last has been shuffled in ("if there are no set-aside modular
   * encounter sets remaining", Wheel of Genres). docs/phase7-wave4.md §3.18.
   */
  readonly setAsideModularSets?: readonly SetAsideModularSet[];
  /** Scenario decks by name (docs/phase7-wave2.md §3.3). Empty for every scenario that has none. */
  readonly scenarioDecks: Readonly<Record<string, ScenarioDeckState>>;
  /**
   * Decks that ran out since the flow last looked, oldest first: a player's deck as it resets, a scenario deck as it
   * empties, an encounter deck as it resets (recorded only when an ability listens; docs/phase7-wave6.md §3.60). The
   * flow announces each as `deckRanOut` between frames (when an ability listens) and empties the list.
   * Absent until a deck first runs out, so a fresh game serializes as before. docs/phase7-wave4.md §3.11.
   */
  readonly pendingDeckRunOuts?: readonly DeckRunOut[];
  /**
   * Encounter cards that left a player's deck since the flow last looked (drawn, or discarded from it), oldest first. The
   * flow announces each as `encounterCardFromPlayerDeck` between frames — after the whole draw, as Mysterio's FAQ (MC27
   * p. 21) asks: "those cards are drawn simultaneously. Afterward, deal each encounter card drawn during that process" —
   * and empties the list. Absent until one first leaves a deck. docs/phase7-wave5.md §3.5.
   */
  readonly pendingEncounterFromDeck?: readonly EncounterFromDeck[];
  /**
   * Cards that entered a player's hand since the flow last looked, oldest first, recorded only when some ability in the
   * registry triggers on it: the flow announces each as `cardEntersHand` between frames and empties the list. Absent
   * until one first enters. docs/phase7-wave6.md §3.10.
   */
  readonly pendingEnteredHand?: readonly EnteredHand[];
  /**
   * Facedown encounter cards dealt to players since the flow last looked, oldest first, recorded only when some ability
   * in the registry triggers on it: the flow announces them as `encounterCardDealt` between frames, sharing one
   * response window, and empties the list. Absent until one is first dealt. docs/phase7-wave9.md §3.12.
   */
  readonly pendingEncounterDealt?: readonly DealtEncounterCard[];
  /**
   * Cards that left play since the flow last looked, oldest first, recorded by `leavePlay` only when some ability in the
   * registry triggers on it: the flow announces each as `cardLeavesPlay` between frames and empties the list. Absent
   * until one first leaves. docs/phase7-wave5.md §3.13. A card whose leaving an interrupt heard is not listed: its
   * `cardLeavesPlay` went on the stack before it moved (§4.1 Q17).
   */
  readonly pendingLeftPlay?: readonly LeftPlay[];
  /**
   * Status cards placed since the flow last looked, oldest first, recorded by `giveStatus` only when some ability in
   * the registry triggers on it: the flow announces each as `statusPlaced` between frames and empties the list. Absent
   * until one is first placed. docs/phase7-wave7.md §3.27.
   */
  readonly pendingStatusPlaced?: readonly StatusPlaced[];
  /**
   * Cards discarded from a player's deck since the flow last looked, oldest first, recorded by `recordDeckDiscard` only
   * when some ability in the registry triggers on it: the flow announces them as `cardDiscardedFromDeck` between
   * frames, in one shared response window, and empties the list. Absent until one is first recorded.
   * docs/phase7-wave7.md §3.55.
   */
  readonly pendingDeckDiscards?: readonly DeckDiscard[];
  /**
   * Tucked cards discarded since the flow last looked, oldest first, recorded by `recordTuckedDiscard` only when some
   * ability in the registry triggers on it: the flow announces them as `tuckedCardDiscarded` between frames, in one
   * shared response window, and empties the list. Absent until one is first recorded. docs/phase7-wave9.md §3.40.
   */
  readonly pendingTuckedDiscards?: readonly TuckedDiscard[];
  /**
   * Announced deck discards whose response window has not finished, each with the frame whose bound set it would leave
   * (`DeckDiscardWindow`). Absent when there is none. docs/phase7-wave7.md §3.55, §4.1 Q32.
   */
  readonly deckDiscardWindows?: readonly DeckDiscardWindow[];
  readonly villainArea: readonly InstanceId[];
  readonly victoryDisplay: readonly InstanceId[];
  readonly removedFromGame: readonly InstanceId[];
  readonly instances: Readonly<Record<string, CardInstance>>;
  /** Printed card data, carried in state so a saved game replays without external lookup. */
  readonly cardPool: Readonly<Record<string, AnyCard>>;
  /** Resolution stack; index 0 is resolving now. `step` is phase structure, this is within a step. */
  readonly stack: readonly StackFrame[];
  /** `instanceId:abilityId` → times used, for "Limit X per phase/round" (RRG "Limit"). */
  readonly abilityUses: Readonly<Record<string, number>>;
  /** Effects that outlive the ability that created them (RRG "Lasting Effects"). */
  readonly lastingEffects: readonly LastingEffect[];
  /**
   * The last observed value of each live `stateCheck` ability's condition, keyed `instanceId:abilityId`, so the
   * ability fires on the change to true and not again while it stays true (`resolve/state-checks.ts`).
   */
  readonly stateChecks: Readonly<Record<string, boolean>>;
  /**
   * Characters a defeat sweep found at zero or fewer remaining hit points and left in play because a "cannot be
   * defeated" rule covered them (`resolve/defeat.ts` `holdAtZero`). Watched between frames: one that is healed above
   * zero or leaves play is dropped, and one the rule stops covering is defeated at once (`resolve/state-checks.ts`
   * `checkDefeatProtectionEnded`; docs/phase7-wave7.md §3.34, §4.1 Q21). Absent in a game that never held one.
   */
  readonly heldAtZero?: readonly InstanceId[];
  /**
   * Side schemes whose last threat was removed while a `notDefeatedWithoutThreat` rule covered them, left in play at no
   * threat (`resolve/event.ts` `applyRemoveThreat`). Watched between frames like `heldAtZero`: one that has threat
   * again or has left play is dropped, and one the rule stops covering is defeated at once (RRG 1.8 "Defeat", p. 15;
   * `resolve/state-checks.ts` `checkSchemeProtectionEnded`; docs/phase7-wave8.md §3.40: "The [MISSION] side scheme
   * cannot be defeated while there are any minions in the mission area"). Absent in a game that never held one.
   */
  readonly heldAtNoThreat?: readonly InstanceId[];
  /**
   * The hit points each damaged character in play was last seen to have, keyed by instance id, so a fall is noticed
   * the moment it happens: RRG 1.8 "Hit Points" (p. 22), an ally or minion whose "+X hit points" "ceases to be in
   * effect" with damage on it equal to or greater than its hit points is defeated, and an identity's or villain's dial
   * is reduced by X (`resolve/state-checks.ts` `checkHitPointsFell`). Memory of an edge and nothing else: a
   * character's hit points are always derived (`maxHitPoints`), never read from here. Only characters with damage on
   * them have an entry, and the field is absent while there is none.
   */
  readonly hitPointsSeen?: Readonly<Record<string, number>>;
  /**
   * The card last logged as showing on top of each player's deck under a `topOfDeckFaceup` rule (docs/phase7-wave8.md
   * §3.48), so the log says `deckTopShown` / `deckTopHidden` once per change (`announceDeckTops`, `deck-top.ts`). This
   * is the log's memory and nothing else: which card is visible is never read from here, it is derived from the deck's
   * order and the rule (`shownDeckTop`). A player with nothing showing has no entry, and the field is absent in a game
   * where no card is.
   */
  readonly deckTopsAnnounced?: Readonly<Record<string, InstanceId>>;
  /**
   * Cards played this round, by title, across every player: RRG 1.8 "Max, Maximum" (p. 28), "'Max X per [period]'
   * imposes a maximum number of times that copies of that card can be played", and a cancelled card still counts.
   * Reset when the round ends.
   */
  readonly playedThisRound: Readonly<Record<string, number>>;
  /** Cards played this phase, by title, across every player: "Max 1 per phase." (Maximum Velocity). Reset when a phase ends. */
  readonly playedThisPhase: Readonly<Record<string, number>>;
  /** Cards played this round keyed `<playerId>:<card type>` ("the first ally played each round"). Reset when the round ends. */
  readonly playedByPlayerThisRound: Readonly<Record<string, number>>;
  /**
   * Who attacked whom **this turn**, keyed by the attacked character and listing each attack's attacker with the title
   * it showed when it attacked, each pair once, in attack order: "Attach to an enemy that X-23 or Honey Badger attacked
   * this turn" (Puncture Wound 43012; `HostQualifiers.attackedThisTurnBy`, docs/phase7-wave2.md §11.3, §14).
   *
   * - **Written** by every attack, player-made or enemy-made, at the `characterAttacked` event (the one place both
   *   paths go through) — but only while a player's turn is in progress, since outside one there is no "this turn"
   *   (RRG 1.8 "Player Phase" / "Player Turn", p. 34; the same reading as `LastingUntil "endOfTurn"`, §13.3).
   * - **Cleared** when each turn begins and when it ends, so the villain phase and the end-of-phase steps see an empty
   *   record rather than the last player's.
   * - **The title is the attacker's at attack time**, read from an identity's faceup side (`titleShowing`): "that
   *   X-23 attacked" is a fact about the attack, and RRG 1.8 "Identity" (p. 23) has a title name "only … the identity
   *   with that title, and not … the other side of the card". So an identity that attacked as X-23 and then changed
   *   to Laura Kinney still attacked as X-23, and nothing an alter-ego does is recorded under the hero's title.
   */
  readonly attackedThisTurn: Readonly<Record<string, readonly AttackRecord[]>>;
  /**
   * Every attack made **this turn**, in order, repeats included (`attackedThisTurn` keeps each attacker/target pair
   * once): "2 facedown boost cards instead if this is the first attack this turn" (Venom III, `sm` 27075; `Predicate
   * firstAttackThisTurn`, docs/phase7-wave5.md §3.12). Written and emptied exactly where `attackedThisTurn` is. Absent
   * until a game's first attack in a turn, so an older save reads as before.
   */
  readonly attacksThisTurn?: readonly AttackThisTurn[];
  /**
   * Which characters have attacked and which have thwarted **this phase**: "If your hero attacked and thwarted this
   * phase" (`Predicate characterDidThisPhase`, docs/phase7-wave7.md §3.36, §4.1 Q23). A set in the order things
   * happened: a character that attacks twice has one "attack" entry, so nothing here counts attacks.
   *
   * - **"Attack"** is written where `attacksThisTurn` is, at the `characterAttacked` event every attack ends with,
   *   basic or by an "(attack)" ability (RRG 1.8 "Labeled Ability", p. 26: "an attack made by that player's identity"),
   *   in either phase. So an attack into a tough status card is an attack (it dealt 0 damage, but it was made), and a
   *   stunned character's attack, which is canceled (RRG 1.8 "Stunned", p. 41), is not.
   * - **"Thwart"** is written when a `thwart` event resolves, the point "after you thwart" responses hear: once for a
   *   basic thwart or each of its divided shares, once for a "(thwart)" ability however many instances of threat it
   *   removes (RRG 1.8 "Thwart", p. 44). A thwart that resolved against a scheme with no threat left on it removed 0
   *   and is one; a confused character's thwart (RRG 1.8 "Confused", p. 13), a canceled one, and one that patrol or
   *   a crisis icon forbids never happened and are not.
   * - **Removed** at every phase boundary, where `playedThisPhase` is emptied: the player phase is one phase across
   *   every player's turn and its end-of-phase steps (RRG 1.8 "Player Phase", p. 34), so the record outlasts a turn;
   *   what a hero does in the villain phase counts for that villain phase only.
   *
   * Absent until a phase's first attack or thwart and again after each phase boundary, so an older save reads as
   * nothing recorded.
   */
  readonly characterActsThisPhase?: readonly CharacterActThisPhase[];
  /**
   * Every card revealed this round, in order, with who revealed it and in which phase (RRG 1.8 "Reveal", p. 37): "The
   * first [Technique] attachment revealed each round gains surge" (Nebula I–III, `gmw`), "The first treachery the engaged
   * player reveals each villain phase gains surge" (Mister Knife, `stld`). Written by every reveal whatever is in play,
   * because "the first" counts cards revealed before the rule's card arrived; emptied when the round ends. Absent until a
   * game's first reveal, so a freshly set-up game serializes as before. docs/phase7-wave3.md §3.8.
   */
  readonly revealedThisRound?: readonly RevealRecord[];
  /**
   * The cards each player has played **this turn**, in order: "7 damage instead if you have played a [Thwart] event this
   * turn" (Decisive Blow, `gam`), "5 threat instead if you have played an [Attack] event this turn" (Forward Momentum).
   * Written when a play commits (so a card counts from the moment it is played), emptied when a turn begins and ends, as
   * `attackedThisTurn` is. Absent until a game's first play. docs/phase7-wave3.md §3.24 (specified in wave 2 §13.4).
   */
  readonly playedThisTurn?: Readonly<Record<string, readonly InstanceId[]>>;
  /**
   * The cards each player has played **this phase**, in order: "You cannot play this card if you have played another
   * card this phase" (Mulligan, `deadpool` 44048; docs/phase7-wave7.md §7.3). `playedThisTurn` is emptied when a turn
   * ends and `playedThisPhase` counts titles across every player, so neither sees a card this player played in an
   * earlier turn of the same player phase (an Action event may be played during another player's turn, RRG 1.8
   * "Action", p. 6). Written when a play commits, in either phase; removed at every phase boundary, where
   * `playedThisPhase` is emptied (the player phase is one phase across every turn, RRG 1.8 "Player Phase", p. 34).
   * Absent until a phase's first play, so an older save reads as nothing played.
   */
  readonly playedByPlayerThisPhase?: Readonly<Record<string, readonly InstanceId[]>>;
  /**
   * The scenario's own out-of-play game areas by name (`ZoneId scenarioArea`; The Collection, docs/phase7-wave3.md
   * §3.14), each in the order cards entered it. Absent until a scenario creates one, so other games serialize as before.
   */
  readonly scenarioAreas?: Readonly<Record<string, readonly InstanceId[]>>;
  /**
   * The scenario's in-play areas that no player controls, by name (`ZoneId scenarioPlayArea`; the mission area,
   * docs/phase7-wave8.md §3.33). Absent until a scenario creates one, so other games serialize as before.
   */
  readonly scenarioPlayAreas?: Readonly<Record<string, ScenarioPlayAreaState>>;
  /**
   * The campaign this game is a scenario of, exactly as the runner composed it (design §7.1) — **frozen**: nothing
   * in a game ever writes here. Because it lands in the replay baseline, a saved campaign game replays without
   * consulting the campaign log at all, which is what lets the log keep evolving underneath saved games.
   *
   * **Absent, not null, outside a campaign** (with `campaignWrites`, which is present exactly when this is): a
   * standalone game's serialized state is byte for byte what it was before campaign mode existed, so every save
   * written until now still replays.
   */
  readonly campaign?: CampaignGameInput;
  /** What this game has written back to the campaign so far (design §6.1). Present exactly when `campaign` is. */
  readonly campaignWrites?: CampaignInGameWrites;
  /**
   * `GameSetupConfig.stack`, keyed by player id rather than seat index: the cards setup moves to the top of each deck
   * right after the Appendix II step 6 shuffle (`resolveScenarioSetup`). Kept in the baseline so a campaign game, whose
   * shuffle runs as a later flow step, still has it, and so the log shows why those cards were on top. Not a rules
   * feature: tutorials and scripted scenarios only. **Absent** unless the setup config stacked a card, so every other
   * game serializes as before.
   */
  readonly setupStack?: StackedDecks;
  /**
   * The setup window in which no villain has been put into play by the game setup itself: every villain started set
   * aside (`GameSetupConfig.villainsStartSetAside`) and card text is to bring the starting ones in (`addVillain`; Gotta
   * Get Away 1A, "Put 1 random MARAUDER villain into play"; Sinister Synchronization 1A). **Present** from `createGame`
   * until RRG 1.8 Appendix II step 12c (p. 51) has resolved, and absent in every other game and from then on. While it
   * is present "the villain" may be nobody; it lists, in the order they entered, the villains put into play without
   * being revealed, whose Setup and When Revealed abilities step 12c still owes (the `villainSetupAbilities` step).
   * docs/phase7-wave7.md §3.42.
   */
  readonly villainsEnteringAtSetup?: readonly InstanceId[];
  /**
   * Setup-keyword cards RRG 1.8 Appendix II step 11 (p. 51) took out of an encounter deck that could not enter play yet:
   * attachments with no card to attach to, because every villain started set aside (`villainsEnteringAtSetup`). They
   * wait faceup in `encounterSetAside`, in the order step 11 found them, and enter play when a villain does
   * (`resolve/setup-cards.ts`). **Absent** unless a card is waiting, and never present once step 12c has begun.
   */
  readonly setupCardsAwaitingHost?: readonly InstanceId[];
  readonly pendingChoice: PendingChoice | null;
  readonly outcome: GameOutcome | null;
  readonly rng: RngState;
  readonly nextInstanceSeq: number;
  readonly nextChoiceSeq: number;
  readonly nextFrameSeq: number;
  readonly nextLastingSeq: number;
}
