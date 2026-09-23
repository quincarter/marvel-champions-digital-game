import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { DRAX_KIT } from "./drax-kit.js";
import { DRAX_OBLIGATION_NEMESIS } from "./drax-obligation-nemesis.js";
import { DRAX_PACK_CARDS } from "./drax-pack-cards.js";

/**
 * Every Drax (`drax`) ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). See
 * docs/phase7-wave3-scripting.md.
 */
export const DRAX_ABILITIES: AbilityRegistry = mergeRegistries(DRAX_KIT, DRAX_OBLIGATION_NEMESIS, DRAX_PACK_CARDS);
