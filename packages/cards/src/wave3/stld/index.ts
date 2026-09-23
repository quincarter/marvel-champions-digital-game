import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { STAR_LORD_KIT } from "./star-lord-kit.js";
import { STAR_LORD_OBLIGATION_NEMESIS } from "./star-lord-obligation-nemesis.js";

/** Every scripted `stld` (Star-Lord) ability: his hero kit plus his obligation/nemesis set. */
export const STLD_ABILITIES: AbilityRegistry = mergeRegistries(STAR_LORD_KIT, STAR_LORD_OBLIGATION_NEMESIS);
