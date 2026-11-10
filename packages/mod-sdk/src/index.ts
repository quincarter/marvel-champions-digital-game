/**
 * The mod SDK (docs/custom-content-packs.md §11.2). Browser-safe: the build lives in `./build.ts`
 * (`@mc/mod-sdk/build`), which needs Node.
 */
export * from "@mc/cards";
export { dslFeatures, SUPPORTED_DSL_FEATURES } from "./features.js";
export { definePackAbilities, PACK_ABILITY_ID } from "./define.js";
export { sha256Hex } from "./sha256.js";
export { readPackInput, validatePack, REQUIRED_PACK_FILES } from "./validate.js";
export type { PackInput, PackIssue, ValidateOptions } from "./validate.js";
export { cardPoolWithPack, gameDepsWithPack } from "./game.js";
export { packObligation } from "./obligation.js";
