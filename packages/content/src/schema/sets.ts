import type { CoreAspect } from "./aspects.js";
import type { Trait } from "./common.js";
import type { CampaignId, CardId, CycleId, EncounterSetId, ScenarioId, SetCode, StarterDeckId } from "./ids.js";

/** A cycle groups packs the way FFG/Hall of Heroes group product releases (e.g. "Core", "The Rise of Red Skull"). */
export interface Cycle {
  readonly id: CycleId;
  readonly name: string;
  /** Release order, used for default sort and for "as of the latest cycle" checks. */
  readonly order: number;
}

/** A single physical product (Core Set, a Hero Pack, a Scenario Pack, a campaign box). */
export interface Pack {
  readonly code: SetCode;
  readonly name: string;
  readonly cycleId: CycleId;
  readonly releaseDate?: string;
}

/**
 * Modular encounter sets appear across multiple products (e.g. "Legions of
 * Hydra" ships in more than one box). A card's `encounterSetIds` (on the
 * encounter-card base type) is the many-to-many link; this record is the set
 * itself plus which packs it originally/also shipped in.
 */
export interface EncounterSet {
  readonly id: EncounterSetId;
  readonly name: string;
  readonly packCodes: readonly SetCode[];
  /** Set if this is a hero-specific nemesis set rather than a general modular set. */
  readonly nemesisOfIdentityId?: CardId;
  /**
   * True for a campaign's set (wave 2): The Rise of Red Skull's Hydra Campaign set and its four Expert Campaign Sets.
   * RRG 1.8 "Campaign-Specific Card" (p. 11): "Campaign-specific cards can only be used during a campaign from the same
   * product", "designated by the word 'Campaign' printed at the bottom of the card in its encounter set name area." No
   * scenario played standalone may list one (campaign mode is not built yet).
   */
  readonly campaignSpecific?: boolean;
  /**
   * True for a set used only in competitive (team-vs-team) mode (wave 2 schema pass, docs/phase7-wave2.md §6.3): Civil
   * War's Standard PvP set (`standard_pvp`). The Civil War rulebook, "Custom Scenario Expansion" (p. 3): "1 Standard PvP
   * Encounter Set. This set replaces the standard encounter set when playing in competitive mode." Competitive mode is
   * not built, so no scenario may list one (`validateScenario`).
   */
  readonly competitiveOnly?: boolean;
  /**
   * `"standard"` / `"expert"` for a set in the Standard or Expert classification: Core's Standard and Expert sets, and
   * The Hood's Standard II and Expert II (docs/phase7-wave4.md §1.9). RRG 1.8 "Standard Set" (p. 40): "The standard set
   * is not a modular encounter set and cannot be selected (by the players or randomly) when a scenario requires players
   * to choose a modular encounter set", and "Cards in the 'Standard' classification are any cards that have the word
   * 'Standard' printed by the bottom of the card in its encounter set name area"; "Expert Set" (p. 19) likewise. Such
   * a set is never a modular choice. Absent: not in either classification.
   */
  readonly classification?: "standard" | "expert";
  /**
   * Decks this set brings to any game it is in (docs/phase7-wave4.md §1.10): the Infinity Gauntlet set's "Infinity Stone
   * deck". MC21 p. 16: "shuffle the six Infinity Stone environment cards together and set them aside, facedown. This is
   * the 'Infinity Stone deck.' The Infinity Stone deck has its own discard pile. […] If the Infinity Stone deck is ever
   * empty, shuffle the Infinity Stone deck discard pile back into the Infinity Stone deck. There is no built-in penalty
   * for doing this." The set "may be used in other scenarios", so the deck is the set's, not a `Scenario`'s. Built at
   * setup whenever the set is in the encounter deck, from that set's cards only.
   */
  readonly separateDecks?: readonly ScenarioSeparateDeck[];
  /**
   * MC21 p. 16: "If there is more than one villain (or no villain) in play at the start of the game, The Infinity
   * Gauntlet set cannot be used." A scenario with `multipleVillains` may not include it.
   */
  readonly singleVillainOnly?: true;
}

/**
 * Chosen at game setup, not a property of the scenario: it selects villain stages (I–II vs II–III) and the
 * Standard/Expert encounter set.
 *
 * This is the two-value **projection** of the wider mode set (`schema/modes.ts`, RRG 1.8 pp. 28–29), not the
 * whole of what a game can be played as. It is declared here because the records below are keyed by it; build a
 * `PlayModes` and call `difficultyOf` to get one.
 */
export type ScenarioDifficulty = "standard" | "expert";

/**
 * The first and last villain stages a difficulty uses, by `VillainStage.stageNumber`: standard `[1, 2]`, expert
 * `[2, 3]`. For villains printed with version letters the numbers are positions (A = 1, B = 2): The Wrecking Crew
 * is standard `[1, 1]` and expert `[2, 2]`; its "extreme challenge" (`[1, 2]`) and a per-villain mix of versions are
 * setup choices, not scenario data.
 */
export type VillainStageRange = readonly [number, number];

/**
 * One villain of a scenario that has several villains in play at once (`Scenario.multipleVillains`).
 */
export interface ScenarioVillain {
  readonly villainCardId: CardId;
  /**
   * The encounter sets this villain's own encounter deck is built from. The Wrecking Crew insert, "Prepare
   * Encounter Decks": "Each villain in The Wrecking Crew has its own encounter deck of 15 cards, identified by the
   * villain's name in the bottom-left corner of each card." The villain card and its signature side scheme share
   * the set but are not shuffled in (as with a Core villain set).
   */
  readonly encounterSetIds: readonly EncounterSetId[];
  /** This villain's signature side scheme (`SideSchemeCard.signatureOf`), put into play at setup. */
  readonly signatureSideSchemeCardId?: CardId;
}

/**
 * Rules for a scenario with several villains in play, from The Wrecking Crew scenario pack insert ("New Rules").
 * The fields are explicit rather than implied by the number of villains, because they are rules the insert states
 * for this scenario, and a later scenario with several villains may state different ones.
 */
export interface MultipleVillains {
  /** Every villain put into play at setup, in printed order. `Scenario.villainCardId` must be the first. */
  readonly villains: readonly [ScenarioVillain, ScenarioVillain, ...ScenarioVillain[]];
  /**
   * `perVillain`: "When an encounter card leaves play, it is placed in the discard pile of its corresponding
   * encounter deck. When a villain's encounter deck is empty, shuffle its discard pile back into its encounter deck
   * and place an acceleration token on the main scheme (per the normal rules of the game)." and "Any card that
   * refers to 'the encounter deck' only refers to the active villain's deck. When the villain is dealt a boost card,
   * it is dealt from the active villain's deck. When a player is dealt an encounter card, it is dealt from the active
   * villain's deck."
   *
   * `shared` (Tower Defense, MC21 p. 10, "Encounter Deck: Tower Defense, Armies of Titan, and Standard sets"): one
   * encounter deck, built from the scenario's own sets as usual; each `ScenarioVillain.encounterSetIds` may be empty.
   * docs/phase7-wave4.md §1.6.
   */
  readonly encounterDecks: "perVillain" | "shared";
  /**
   * `activeVillainOnly`: "There are 4 villains in play at the beginning of the scenario, but only the active villain
   * will activate during the villain phase. The active villain is the villain with the active counter (all-purpose
   * counter). [...] Any card effect that refers to 'the villain' only refers to the active villain." and "When the
   * active villain is defeated, move the active counter to the villain whose side scheme has the most threat. (In
   * case of a tie, the first player decides.)" and "Note: Players may attack any villain or thwart any scheme
   * regardless of which villain is the active villain."
   */
  readonly activation: "activeVillainOnly";
  /**
   * `allVillainsDefeated`: "When a villain is defeated, their side scheme is also removed from the game. Any
   * encounter cards from that villain's deck that are in play remain in play. If the players defeat all 4 villains,
   * they win the game!"
   */
  readonly winCondition: "allVillainsDefeated";
}

/**
 * A deck a scenario adds to the game besides its villain, main scheme and encounter decks (wave 2). RRG 1.8 "Deck"
 * (p. 15): "Certain identities or scenarios may add other decks to the game." Built by the main scheme's 1A `Setup:`
 * ability ("Create the Experimental Weapons deck"), which moves the matching cards out of the encounter deck built at
 * Appendix II step 10; the engine never builds it on its own.
 *
 * - Experimental Weapons (Attack on Mount Athena), the Red Skull rulebook, p. 5: "take all four cards in the
 *   Experimental Weapons encounter set, shuffle them together, and set them facedown next to the main-scheme deck.
 *   [...] After a card from the Experimental Weapons deck enters play, it is considered to be part of the encounter
 *   deck. When that card is discarded, it is placed in the encounter deck discard pile."
 * - The side-scheme deck (The Rise of Red Skull), the Red Skull rulebook, p. 15: "search the encounter deck for each
 *   side scheme and shuffle them together into their own deck [...] The side-scheme deck has its own discard pile.
 *   When a side-scheme is defeated or otherwise discarded, place it in the side-scheme discard pile. If the
 *   side-scheme deck is ever empty, shuffle the side-scheme discard pile into the side-scheme deck. There is no
 *   penalty for doing this." Errata (RRG 1.8 p. 66, #128A): "Shuffle every other encounter side scheme".
 */
export interface ScenarioSeparateDeck {
  /** The deck's name as the cards print it ("Experimental Weapons", "side-scheme"). */
  readonly name: string;
  /** Which encounter-deck cards form it: every card of the listed sets, and/or every card of one type. At least one. */
  readonly contents: {
    readonly encounterSetIds?: readonly EncounterSetId[];
    readonly cardType?: "side_scheme" | "environment";
    /** Only cards with this printed trait (the six Infinity Stones, not the Infinity Gauntlet; docs/phase7-wave4.md §1.10). */
    readonly trait?: Trait;
  };
  /** `own`: a discard pile of its own. `encounter`: its cards are discarded to the encounter discard pile. */
  readonly discardPile: "own" | "encounter";
  /** What happens when it is empty. Mirrors `IdentitySeparateDeck.whenEmpty`. */
  readonly whenEmpty: "reshuffleDiscardWithoutPenalty" | "remainsEmpty";
}

/**
 * The rules for players split into separate game areas (wave 2), from The Once and Future Kang insert, "Create
 * Separate Game Areas" and "Playing With Separate Game Areas". Explicit fields, as for `MultipleVillains`, because they
 * are rules this insert states for this scenario. The areas themselves are created by card abilities (stage 3A:
 * "Create your own game area and place this scheme in it"); nothing here creates one.
 */
export interface SeparateGameAreas {
  /**
   * "Cards and components in one game area cannot affect another game area (with the exception of the text on stage
   * 2B). Players cannot attack or defend enemies in other game areas, and they cannot target any game elements in the
   * other game areas." and "Stage 2B remains in play in a central location and its text remains active for all
   * players, though it is not part of any other game area."
   */
  readonly isolation: "areasCannotAffectEachOther";
  /** The main scheme stage that stays central and affects every area (Kang: 2). */
  readonly centralStageNumber: number;
  /** "they continue to use the same encounter deck and encounter discard pile." */
  readonly encounterDeck: "shared";
  /** RRG 1.8 FAQ "The Once and Future Kang Scenario Pack" (p. 60): "Environment cards are considered to be in all players' game areas." */
  readonly environments: "inEveryArea";
  /** Insert, "Rules Clarifications": "'Each player' refers to each player in the same game area." */
  readonly eachPlayer: "sameArea";
  /**
   * Insert, "Rules Clarifications": "a unique card in one game area places no limitations on the others. When players
   * combine game areas, they must discard copies of unique cards until only one of each remains in that game area. If
   * the players cannot agree which one to discard, the first player decides."
   */
  readonly uniqueness: "perArea";
  /**
   * Insert, "Joining Another Game Area": "Any side schemes that were in play in your previous game area become part of
   * the game area that you join. Any minions that were engaged with you remain engaged with you." Turn order and the
   * first player token are unchanged ("Play still proceeds in turn order").
   */
  readonly joining: "sideSchemesAndEngagedMinionsMove";
}

/** A scenario references its encounter sets, main scheme, and villain by id — it does not embed card data. */
export interface Scenario {
  readonly id: ScenarioId;
  readonly name: string;
  readonly packCode: SetCode;
  /** The villain, or with `multipleVillains` the first of the villains. */
  readonly villainCardId: CardId;
  readonly mainSchemeCardId: CardId;
  /** Sets that are always in this scenario's encounter deck (villain set); modular sets are chosen at setup. */
  readonly encounterSetIds: readonly EncounterSetId[];
  readonly recommendedModularSetIds: readonly EncounterSetId[];
  /** Added in standard mode (Core: `standard`). */
  readonly standardEncounterSetIds: readonly EncounterSetId[];
  /** Added in expert mode *in addition to* the standard sets (Core: `expert`). */
  readonly expertEncounterSetIds: readonly EncounterSetId[];
  readonly villainStages: {
    readonly standard: VillainStageRange;
    readonly expert: VillainStageRange;
  };
  /** Present when more than one villain is in play at once (The Wrecking Crew). Absent = one villain. */
  readonly multipleVillains?: MultipleVillains;
  /**
   * Whether each identity's obligation and nemesis set are used (RRG 1.8 Appendix II, steps 4–5). Absent = true.
   * The Wrecking Crew insert: "Note: Nemesis cards and obligations are not used when playing this scenario."
   */
  readonly usesIdentityEncounterSets?: boolean;
  /**
   * How many modular encounter sets the scenario's stage 1A "Contents" calls for. Absent = 1 ("One modular
   * encounter set", every Core and Green Goblin scenario). The Wrecking Crew insert, "Adjustable Difficulty":
   * "The Wrecking Crew does not use other encounter sets", so 0.
   */
  readonly modularSetCount?: number;
  /**
   * Villain cards of this scenario that are not in the villain deck at setup, but set aside for card abilities to
   * bring in (wave 2). The Once and Future Kang insert, "Setup": "stage 1A instructs the players to set each copy of
   * Kang (II) and Kang (III) aside. This means that Kang (I) is the only villain in the villain deck at the beginning
   * of the game. Kang (II) and Kang (III) will enter play through the card effects on main schemes 3A and 4A."
   * Each Kang card is its own `VillainCard` with one stage, because the four Kang (II) cards have different titles
   * and are not a sequence.
   */
  readonly setAsideVillainCardIds?: readonly CardId[];
  /**
   * Villain cards that replace the scenario's villains in expert mode (wave 2). The Once and Future Kang insert,
   * "Adjustable Difficulty": "To play the scenario in expert mode, replace all six villains in the Kang encounter set
   * with the six villains from the Expert Kang set and add the Expert encounter set to the encounter deck." When set,
   * expert mode uses these instead of `villainCardId` and `setAsideVillainCardIds`.
   */
  readonly expertVillains?: {
    readonly villainCardId: CardId;
    readonly setAsideVillainCardIds: readonly CardId[];
  };
  /**
   * How the players win. Absent = `"finalVillainStage"`, RRG 1.8 "Villain Defeat" (p. 47): "If the final stage of the
   * villain deck is defeated, the players win the game." `"cardAbility"`: only a card ability wins (Kang (III): "When
   * Defeated: The players win the game."). The Once and Future Kang insert, "Setup": "The players must defeat Kang (I),
   * Kang (II), and Kang (III) in order to win the game", although Kang (I) is alone in the villain deck. Scenario rules
   * override the Rules Reference (RRG 1.8 "The Golden Rules", p. 4). `MultipleVillains.winCondition` is separate.
   */
  readonly victory?: "finalVillainStage" | "cardAbility";
  /** Present when the scenario can split the players into separate game areas (The Once and Future Kang). */
  readonly separateGameAreas?: SeparateGameAreas;
  /** Decks this scenario adds besides the villain, main scheme and encounter decks (see `ScenarioSeparateDeck`). */
  readonly separateDecks?: readonly ScenarioSeparateDeck[];
  /**
   * `"random"`: the villain put into play at setup is chosen at random (the game's seeded RNG) among `villainCardId` and
   * `setAsideVillainCardIds` (`expertVillains`' in expert mode), and every other one is set aside. Loki, MC21 p. 24:
   * "choose one Loki villain card at random, reveal it and put it into play. Set the remaining four versions of Loki
   * aside, out of play." Absent: `villainCardId` starts. docs/phase7-wave4.md §1.11.
   */
  readonly startingVillain?: "random";
  /**
   * A number the scenario's own card text compares against, by mode: All Hail King Loki 1B, "If the number of Lokis in
   * the victory display is equal to the victory condition, the players win the game." MC21 p. 24: "Rookie Mode – One
   * version of Loki; Standard Mode – Two versions of Loki; Expert Mode – Three versions of Loki; Heroic Mode – Four
   * versions of Loki" (rookie is RRG 1.8's skirmish mode, p. 28). Read by the engine's `ValueSpec victoryCondition`;
   * `skirmish` and `heroic`, when given, win over `standard`/`expert` in those modes. docs/phase7-wave4.md §1.11.
   */
  readonly victoryCondition?: {
    readonly standard: number;
    readonly expert: number;
    readonly skirmish?: number;
    readonly heroic?: number;
  };
  /**
   * How many modular encounter sets are chosen at setup and set aside rather than shuffled in. Making Connections 1A
   * (The Hood, `hood` 24004a): "Choose 7 modular encounter sets and set them aside (you may choose randomly). Choose 1
   * of those sets at random, then shuffle it into the encounter deck." The shuffle-in is the 1A `Setup:` ability's; this
   * says only how many are set aside. docs/phase7-wave4.md §1.12.
   */
  readonly setAsideModularSetCount?: number;
}

/**
 * Campaign box membership: the plain-data, card-database half of a campaign
 * (docs/campaign-mode-design.md §3, §9.1 row 1). It is *facts about the product* —
 * which scenarios it plays in box order, and which encounter/player sets are
 * campaign-specific to it — never an instruction, a graph, or any other engine
 * type. The DSL that scripts a box's setup/victory instructions is
 * `@mc/cards`' `CampaignDefinition` (`campaign.ts` in `@mc/engine`, authored
 * per box in `@mc/cards/src/campaigns/`), per the `client → cards → engine →
 * content` dependency direction: `@mc/content` cannot import `@mc/engine`.
 */
export interface Campaign {
  readonly id: CampaignId;
  readonly name: string;
  /** The FFG box code as printed on the product ("MC10"). Distinct from `packCode`, the internal `SetCode`. */
  readonly boxCode: string;
  /** RRG 1.8 "Campaign-Specific Card" (p. 11): a campaign-specific card's own product, tested by set icon. */
  readonly packCode: SetCode;
  /** In box/rulebook order. The campaign's `CampaignGraph` (linear or choice) plays these, or a subset of them. */
  readonly scenarioIds: readonly ScenarioId[];
  /** Encounter sets whose cards are campaign-specific to this campaign (MC10: `hydra_camp`, `expcamp`). */
  readonly campaignSetIds: readonly EncounterSetId[];
  /** Per-seat numbered variants of one set (MC10 p. 17's four Expert Campaign Sets), seat 1..4 in order. */
  readonly perSeatSetIds?: readonly EncounterSetId[];
  /** Player cards and modular sets this box forbids *inside* its campaign (MC27 p. 4; MC40 p. 6). */
  readonly prohibited?: {
    readonly cardIds?: readonly CardId[];
    readonly encounterSetIds?: readonly EncounterSetId[];
  };
  /** The primary source this record (and the box's campaign definition) is built from: a repo-relative path. */
  readonly logSheetReference: string;
}

/**
 * Where a starter deck list came from. `verified: false` means the list could
 * not be confirmed against a published source and must not be trusted as the
 * official precon — say so here rather than guessing.
 */
export interface StarterDeckProvenance {
  readonly verified: boolean;
  /** Human-readable source(s), e.g. "Core Set rulebook p.24" or a URL. */
  readonly sources: readonly string[];
  readonly note?: string;
}

/** A pre-built deck as printed/published for a product (e.g. each Core hero's precon). */
export interface StarterDeck {
  readonly id: StarterDeckId;
  readonly name: string;
  readonly packCode: SetCode;
  readonly identityCardId: CardId;
  /** Aspect(s) of the precon. Core precons have exactly one; later products can have more. */
  readonly aspects: readonly CoreAspect[];
  /**
   * Every card in the deck, including the hero's signature cards (identity card excluded). Cards of an identity's
   * separate deck (`PlayerCard.separateDeck`, Doctor Strange's Invocation cards) are never listed: the identity's
   * `separateDecks` defines them.
   */
  readonly cards: readonly { readonly cardId: CardId; readonly quantity: number }[];
  readonly provenance: StarterDeckProvenance;
}
