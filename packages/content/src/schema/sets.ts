import type { CampaignId, CardId, CycleId, EncounterSetId, ScenarioId, SetCode } from "./ids.js";

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

/** A scenario references its encounter sets, main scheme, and villain by id — it does not embed card data. */
export interface Scenario {
  readonly id: ScenarioId;
  readonly name: string;
  readonly packCode: SetCode;
  readonly villainCardId: CardId;
  readonly mainSchemeCardId: CardId;
  /** Sets that are always in this scenario's encounter deck; modular sets are chosen at setup. */
  readonly encounterSetIds: readonly EncounterSetId[];
  readonly recommendedModularSetIds: readonly EncounterSetId[];
}

/** Campaign box membership (e.g. a set of linked scenarios sharing a campaign log). */
export interface Campaign {
  readonly id: CampaignId;
  readonly name: string;
  readonly scenarioIds: readonly ScenarioId[];
}
