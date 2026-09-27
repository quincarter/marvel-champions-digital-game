import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { WHISPERS_OF_PARANOIA } from "./whispers-of-paranoia.js";

/** Sinister Motives modular encounter sets that aren't a scenario's own required set (docs/phase7-wave5.md). */
export const SM_MODULARS_ABILITIES: AbilityRegistry = mergeRegistries(WHISPERS_OF_PARANOIA);
