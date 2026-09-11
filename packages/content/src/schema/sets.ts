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

/** Printed villain stage numerals used by a difficulty, e.g. standard `[1, 2]`, expert `[2, 3]`. */
export type VillainStageRange = readonly [number, number];

/** A scenario references its encounter sets, main scheme, and villain by id — it does not embed card data. */
export interface Scenario {
  readonly id: ScenarioId;
  readonly name: string;
  readonly packCode: SetCode;
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
  /** Every card in the deck, including the hero's signature cards (identity card excluded). */
  readonly cards: readonly { readonly cardId: CardId; readonly quantity: number }[];
  readonly provenance: StarterDeckProvenance;
}
