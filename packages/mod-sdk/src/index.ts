/**
 * The mod SDK (docs/custom-content-packs.md §11.2). Browser-safe: the build lives in `./build.ts`
 * (`@mc/mod-sdk/build`), which needs Node.
 */
export * from "@mc/cards";
export { campaignDefinitionsOf, dslFeatures, SUPPORTED_DSL_FEATURES } from "./features.js";
export { definePackAbilities, PACK_ABILITY_ID } from "./define.js";
export { sha256Hex } from "./sha256.js";
export { isUnscriptedAbilityIssue, readPackInput, splitIssues, validatePack, REQUIRED_PACK_FILES } from "./validate.js";
export type { PackInput, PackIssue, PackIssueCategory, ValidateOptions } from "./validate.js";
export { checkPackCampaigns, isPlainJson, packCampaignsOf } from "./campaigns.js";
export type { PackCampaign } from "./campaigns.js";
export {
  campaignDepsWithPacks,
  campaignGameWithPacks,
  cardPoolWithPack,
  cardPoolWithPacks,
  customContentOfPacks,
  gameDepsWithPack,
  gameDepsWithPacks,
  packCampaignDefinitionOf,
  packCampaignDefinitions,
  packCampaignRecords,
  packEncounterSetRecords,
  packModularSetChoices,
  packScenarioRecords,
  scenarioWithPacks,
} from "./game.js";
export type { PackGameContent } from "./game.js";
export { packObligation } from "./obligation.js";
export { builtinGameDeps, validateBuiltinPack } from "./builtin.js";
export type { BuiltinValidateOptions } from "./builtin.js";
