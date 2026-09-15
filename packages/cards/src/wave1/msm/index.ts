import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { MSM_KIT } from "./kit.js";
import { MSM_NEMESIS } from "./nemesis.js";
import { MSM_OBLIGATION } from "./obligation.js";
import { MSM_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Ms. Marvel (`msm`) pack ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). This is
 * the ONE export `../index.ts` adds for this pack — see `docs/phase7-wave1-scripting.md`.
 */
export const MSM_ABILITIES: AbilityRegistry = mergeRegistries(MSM_KIT, MSM_OBLIGATION, MSM_NEMESIS, MSM_PACK_CARDS);
