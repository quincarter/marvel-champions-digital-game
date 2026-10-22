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
// Wave 7 (cycle 7, NeXt Evolution): joined to `playable/`; its own builder stays exported for its tests.
export { WAVE7_ABILITIES, WAVE7_CARDS, WAVE7_DEPS, wave7Scenario, wave7StarterDeckSetup } from "./wave7/index.js";
export type { Wave7ScenarioOptions } from "./wave7/index.js";
// Wave 8 (cycle 8, Age of Apocalypse): joined to `playable/`. Its campaign definition (`aoa`) is registered in `CAMPAIGNS`.
export { WAVE8_ABILITIES, WAVE8_CARDS, WAVE8_DEPS, wave8Scenario, wave8StarterDeckSetup } from "./wave8/index.js";
export type { HorsemanSide, Wave8ScenarioOptions } from "./wave8/index.js";
// Wave 9 (cycle 9, Agents of S.H.I.E.L.D.): joined to `playable/`, minus the sets `playable/unscripted.ts` gates.
export { WAVE9_ABILITIES, WAVE9_CARDS, WAVE9_DEPS, wave9Scenario, wave9StarterDeckSetup } from "./wave9/index.js";
export type { Wave9ScenarioOptions } from "./wave9/index.js";
// Wave 10 (cycle 10, Civil War): scaffold and scripts in progress, NOT joined to `playable/` yet.
export {
  WAVE10_ABILITIES,
  WAVE10_CARDS,
  WAVE10_DEPS,
  WAVE10_GAME_ENCOUNTER_SETS,
  wave10Scenario,
  wave10StarterDeckSetup,
} from "./wave10/index.js";
export type { Wave10Difficulty, Wave10ScenarioOptions } from "./wave10/index.js";
// Wave 11 (cycle 11, Jessica Jones and Luke Cage hero packs): scaffold, scripts in progress; its abilities are in `playable/`.
export { WAVE11_ABILITIES, WAVE11_CARDS, WAVE11_DEPS } from "./wave11/index.js";
// Fear No Evil's scenarios: the main scheme is the scenario, the villain an option (docs/phase7-wave11-scenarios.md §S3.3).
export {
  WAVE11_GAME_ENCOUNTER_SETS,
  buildWave11Scenario,
  scenarioWithVillain,
  villainChoiceOf,
  villainOptionOf,
  wave11Scenario,
  wave11ScenarioRecord,
  wave11StarterDeckSetup,
} from "./wave11/setup.js";
export type { Wave11ScenarioOptions } from "./wave11/setup.js";
// A main scheme deck made of chosen stages (the Civil War leaders): picks to `mainSchemeStageIndexes`, and the options.
export {
  chooseMainSchemeStages,
  mainSchemeStageGist,
  mainSchemeStagesOffer,
  mainSchemeStagesProblem,
} from "./main-scheme-stages.js";
export type { MainSchemeStageContext, MainSchemeStageOption, MainSchemeStagesOffer } from "./main-scheme-stages.js";
export { UNSCRIPTED_ENCOUNTER_SET_IDS } from "./playable/unscripted.js";
// Which optional setup choices a playable scenario offers (Standard III, the Horsemen's versions, the easier
// Apocalypse start, threat on Gene Pool): what a setup screen asks before it draws a control.
export {
  INFINITES_GENE_POOL_THREAT_MAX,
  RANDOM_VILLAIN,
  checkPlayableDifficultySets,
  civilWarGameModes,
  civilWarModularSets,
  civilWarSidesOffer,
  difficultySetAlternativesFor,
  expertSetReplaceable,
  genePoolThreatOffer,
  horsemanSidesOffer,
  infinitesGenePoolThreatRecommendation,
  offersEasierStart,
  offersGenePoolThreat,
  playableScenarioOffer,
  scenarioGameSetIds,
  standardSetReplaceable,
  villainChoiceOffer,
} from "./playable/scenario-options.js";
export type {
  CivilWarLeaderOffer,
  CivilWarSideOffer,
  DifficultySetAlternatives,
  GameModeOption,
  GenePoolThreatOffer,
  HorsemanSidesOffer,
  MainSchemeStagesChoiceOffer,
  ModularSetCountOffer,
  ModularSetLegality,
  PlayableScenarioChoices,
  PlayableScenarioOffer,
  VillainChoice,
  VillainChoiceOffer,
} from "./playable/scenario-options.js";
export { PLAYABLE_ABILITIES, PLAYABLE_DEPS, playableScenario, playableStarterDeckSetup } from "./playable/index.js";
export { randomCivilWarScenario } from "./playable/random-civil-war.js";
export type { RandomCivilWarOptions, RandomCivilWarScenario } from "./playable/random-civil-war.js";
export type { PlayableScenarioOptions } from "./playable/index.js";
// Community decks: the saved, tested public MarvelCDB decklists, as a catalog a client can recommend from.
export {
  COMMUNITY_DECK_AUTHORS,
  communityDeckUrl,
  communityDecks,
  skippedCommunityDecks,
} from "./playable/community-decks.js";
export type { CommunityDeck, SkippedCommunityDeck } from "./playable/community-decks.js";
export {
  AOA_CAMPAIGN_DEFINITION,
  AOA_DEFEATED,
  AOA_MISSIONS,
  AOA_NOT_DEFEATED,
  AOA_OVERSEERS,
  AOA_PROTECT_THE_PROFESSOR,
  AOS_CAMPAIGN_DEFINITION,
  CAMPAIGNS,
  campaignDefinitionOf,
  campaignModularPickProblem,
  cardsOfComposedSets,
  GMW_CAMPAIGN_DEFINITION,
  MOJO_CAMPAIGN_DEFINITION,
  mojoCheckedOffSets,
  mojoModularSetPicks,
  MTS_CAMPAIGN_DEFINITION,
  NEXT_EVOL_CAMPAIGN_DEFINITION,
  SHADOWLAND_CAMPAIGN_DEFINITION,
  SM_CAMPAIGN_DEFINITION,
  TRORS_CAMPAIGN_DEFINITION,
} from "./campaigns/index.js";
export {
  PLAYABLE_ENCOUNTER_SETS,
  PLAYABLE_SCENARIO_RECORDS,
  checkModularPickCount,
  chosenModularSetIds,
  isModularChoice,
  isScenarioSpecificSet,
  modularPickCountProblem,
  modularPickCountRange,
  modularPickProblem,
  scenarioSideClause,
} from "./modular-pool.js";
