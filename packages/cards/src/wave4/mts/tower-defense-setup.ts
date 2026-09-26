/**
 * The Tower Defense scenario's own `GameSetupConfig` builder (docs/phase7-wave4.md §2.2, §3.2, §5): two villains
 * sharing one encounter deck (`MultipleVillains.encounterDecks: "shared"`, `GameSetupConfig.sharedEncounterDeck`),
 * two paired main schemes (`putMainSchemeStageIntoPlay`, wired by `21098a.setup`), and Proxima Midnight/Corvus
 * Glaive's own three-stage `VillainCard`s (`@mc/content`'s `MTS_CARDS`, 21092/21095 — docs/phase7-wave4.md §1.6).
 *
 * A thin wrapper over `../setup.js`'s own `wave4Scenario` (which now builds any `multipleVillains` `MTS_SCENARIOS`
 * record generically, `buildMtsMultipleVillains`) rather than a separate builder: this used to duplicate
 * `wave4Scenario`'s starter-deck/stage-index/encounter-set plumbing before that generic support existed.
 */
import type { DifficultySetChoice, PlayModes, ScenarioSetupOptions } from "@mc/content";
import type { GameSetupConfig } from "@mc/engine";
import type { CoreDifficulty, CorePlayer } from "../../core/setup.js";
import { wave4Scenario } from "../setup.js";

export type TowerDefenseDifficulty = CoreDifficulty;

export interface TowerDefenseOptions {
  readonly seed: number;
  readonly players: readonly CorePlayer[];
  readonly difficulty?: TowerDefenseDifficulty;
  readonly modularSetIds?: readonly string[];
  readonly firstPlayerIndex?: number;
  /** Standard II / Expert II instead of the printed sets (docs/phase7-wave4.md §4 Q5); absent is the printed sets. */
  readonly difficultySets?: DifficultySetChoice;
  /** The full mode set (heroic included), as `CoreScenarioOptions.modes`; must agree with `difficulty` about expert. */
  readonly modes?: PlayModes;
  /** MC21 p. 11's optional setup damage on Avengers Tower (docs/phase7-wave4.md §4 Q4); absent is none. */
  readonly setupOptions?: ScenarioSetupOptions;
}

/** Tower Defense: two villains sharing one encounter deck, two main schemes, Focused Defense (§3.2-§3.5). */
export function towerDefenseScenario(options: TowerDefenseOptions): GameSetupConfig {
  return wave4Scenario("tower-defense", options);
}
