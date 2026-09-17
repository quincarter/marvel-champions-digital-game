import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { CAP_KIT } from "./kit.js";
import { CAP_NEMESIS } from "./nemesis.js";
import { CAP_OBLIGATION } from "./obligation.js";
import { CAP_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Captain America (`cap`) pack ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`).
 * This is the ONE export `../index.ts` adds for this pack — see `docs/phase7-wave1-scripting.md`.
 */
export const CAP_ABILITIES: AbilityRegistry = mergeRegistries(CAP_KIT, CAP_OBLIGATION, CAP_NEMESIS, CAP_PACK_CARDS);
