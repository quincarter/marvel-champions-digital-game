export * from "./dsl/index.js";
export {
  CORE_ABILITIES,
  CORE_DEPS,
  coreScenario,
  encounterCardsOf,
  resolveModes,
  starterDeckSetup,
} from "./core/index.js";
export type { CoreDifficulty, CorePlayer, CoreScenarioOptions } from "./core/index.js";
export {
  WAVE1_ABILITIES,
  WAVE1_DEPS,
  WAVE1_REPRINT_ABILITIES,
  wave1ReprintPairs,
  wave1Scenario,
  wave1StarterDeckSetup,
} from "./wave1/index.js";
export type { Wave1ScenarioOptions } from "./wave1/index.js";
export {
  WAVE2_ABILITIES,
  WAVE2_DEPS,
  WAVE2_REPRINT_ABILITIES,
  wave2ReprintPairs,
  wave2Scenario,
  wave2StarterDeckSetup,
} from "./wave2/index.js";
export type { Wave2ScenarioOptions } from "./wave2/index.js";
export {
  WAVE3_ABILITIES,
  WAVE3_CARDS,
  WAVE3_DEPS,
  WAVE3_REPRINT_ABILITIES,
  wave3ReprintPairs,
  wave3Scenario,
  wave3StarterDeckSetup,
} from "./wave3/index.js";
export type { Wave3ScenarioOptions } from "./wave3/index.js";
// Wave 7 scaffold: reachable here only. Not joined to `playable/` (nothing is scripted; `playableScenario` does not
// offer its scenarios), so exporting it changes nothing a player can do.
export { WAVE7_ABILITIES, WAVE7_CARDS, WAVE7_DEPS, wave7Scenario, wave7StarterDeckSetup } from "./wave7/index.js";
export type { Wave7ScenarioOptions } from "./wave7/index.js";
// Wave 8 scaffold: reachable here only, not joined to `playable/` (nothing is scripted or selectable).
export { WAVE8_ABILITIES, WAVE8_CARDS, WAVE8_DEPS } from "./wave8/index.js";
export { PLAYABLE_ABILITIES, PLAYABLE_DEPS, playableScenario, playableStarterDeckSetup } from "./playable/index.js";
export type { PlayableScenarioOptions } from "./playable/index.js";
export {
  CAMPAIGNS,
  campaignDefinitionOf,
  cardsOfComposedSets,
  GMW_CAMPAIGN_DEFINITION,
  MOJO_CAMPAIGN_DEFINITION,
  mojoCheckedOffSets,
  mojoModularSetPicks,
  MTS_CAMPAIGN_DEFINITION,
  NEXT_EVOL_CAMPAIGN_DEFINITION,
  SM_CAMPAIGN_DEFINITION,
  TRORS_CAMPAIGN_DEFINITION,
} from "./campaigns/index.js";
export {
  checkModularPickCount,
  chosenModularSetIds,
  isModularChoice,
  isScenarioSpecificSet,
  modularPickProblem,
} from "./modular-pool.js";
