import type { CoreAspect } from "./aspects.js";
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
}

/** Chosen at game setup, not a property of the scenario: it selects villain stages (I–II vs II–III) and the Standard/Expert encounter set. */
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
   */
  readonly encounterDecks: "perVillain";
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
}

/** Campaign box membership (e.g. a set of linked scenarios sharing a campaign log). */
export interface Campaign {
  readonly id: CampaignId;
  readonly name: string;
  readonly scenarioIds: readonly ScenarioId[];
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
