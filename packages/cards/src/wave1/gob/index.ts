import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { A_MESS_OF_THINGS } from "./a-mess-of-things.js";
import { GOBLIN_GIMMICKS } from "./goblin-gimmicks.js";
import { MUTAGEN_FORMULA } from "./mutagen-formula.js";
import { POWER_DRAIN } from "./power-drain.js";
import { RISKY_BUSINESS } from "./risky-business.js";
import { RUNNING_INTERFERENCE } from "./running-interference.js";

/**
 * Every Green Goblin (`gob`) pack ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). This
 * is the ONE export `../index.ts` adds for this pack — see `docs/phase7-wave1-scripting.md`.
 */
export const GOB_ABILITIES: AbilityRegistry = mergeRegistries(RISKY_BUSINESS, MUTAGEN_FORMULA, GOBLIN_GIMMICKS, A_MESS_OF_THINGS, POWER_DRAIN, RUNNING_INTERFERENCE);
