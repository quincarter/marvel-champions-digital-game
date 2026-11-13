import type { AbilityRegistry, EngineDeps } from "@mc/engine";
import { CORE_BUILTIN_PACK } from "./pack.js";

/** Every scripted Core Set ability, keyed by `AbilityReference` id: the Core Set pack's abilities. */
export const CORE_ABILITIES: AbilityRegistry = CORE_BUILTIN_PACK.abilities;

/** Engine dependencies for games that use Core Set content. */
export const CORE_DEPS: EngineDeps = { abilities: CORE_ABILITIES };

export { CORE_BUILTIN_PACK } from "./pack.js";
export { coreScenario, encounterCardsOf, resolveModes, starterDeckSetup } from "./setup.js";
export type { CoreDifficulty, CorePlayer, CoreScenarioOptions } from "./setup.js";
