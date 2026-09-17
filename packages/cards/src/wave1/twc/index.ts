import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { BREAKOUT } from "./breakout.js";
import { BULLDOZER_SET } from "./bulldozer.js";
import { PILEDRIVER_SET } from "./piledriver.js";
import { THUNDERBALL_SET } from "./thunderball.js";
import { WRECKER_SET } from "./wrecker.js";

/**
 * Every The Wrecking Crew (`twc`) pack ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`).
 * This is the ONE export this pack adds — see `docs/phase7-wave1-scripting.md`. Merged with `mergeRegistries`
 * (never an object spread — a spread silently hides a duplicate id, `docs/phase7-wave1-scripting.md`).
 */
export const TWC_ABILITIES: AbilityRegistry = mergeRegistries(BREAKOUT, WRECKER_SET, THUNDERBALL_SET, PILEDRIVER_SET, BULLDOZER_SET);
