import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { DOWN_TO_EARTH } from "./down-to-earth.js";
import { GOBLIN_GEAR } from "./goblin-gear.js";
import { OSBORN_TECH } from "./osborn-tech.js";
import { SINISTER_ASSAULT } from "./sinister-assault.js";
import { WHISPERS_OF_PARANOIA } from "./whispers-of-paranoia.js";

/**
 * Sinister Motives modular encounter sets that are not required by any one scenario's own module (unlike City in
 * Chaos, which Sandman's own `sandman/` folder owns because that scenario cannot be built without it) — one file
 * per modular set, mirroring `./sinister-six/guerrilla-tactics.ts`'s shape.
 */
export const SM_MODULAR_ABILITIES: AbilityRegistry = mergeRegistries(
  DOWN_TO_EARTH,
  GOBLIN_GEAR,
  OSBORN_TECH,
  SINISTER_ASSAULT,
  WHISPERS_OF_PARANOIA,
);
