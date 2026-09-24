import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { GAMORA_KIT } from "./gamora-kit.js";
import { GAMORA_OBLIGATION_NEMESIS } from "./gamora-obligation-nemesis.js";

/** Every Gamora (`gam`) ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). See
 * docs/phase7-wave3-scripting.md. */
export const GAM_ABILITIES: AbilityRegistry = mergeRegistries(GAMORA_KIT, GAMORA_OBLIGATION_NEMESIS);
