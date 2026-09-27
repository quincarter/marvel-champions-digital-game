import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { MAZE_OF_MIRRORS } from "./main-scheme.js";
import { MYSTERIO } from "./villain.js";
import { MYSTERIO_ENCOUNTER_SET } from "./encounter-set.js";
import { PERSONAL_NIGHTMARE } from "./personal-nightmare.js";

/**
 * The Mysterio scenario (`sm`, docs/phase7-wave5.md §2.2, the box's third): the villain (27084–27086, `villain.ts`),
 * the main scheme "Maze of Mirrors" → "Edge of Reality" (27087a/b, 27088a/b, `main-scheme.ts`), Mysterio's own
 * encounter set (27089–27093, `encounter-set.ts`), and Personal Nightmare, the scenario's other required set
 * (27153–27157, `personal-nightmare.ts`). Whispers of Paranoia (the recommended modular) is a later agent's work
 * (docs/phase7-wave5.md §2.2), same as `venom/index.ts`'s own Bell Tower/Symbiotic Strength split.
 */
export const MYSTERIO_ABILITIES: AbilityRegistry = mergeRegistries(
  MYSTERIO,
  MAZE_OF_MIRRORS,
  MYSTERIO_ENCOUNTER_SET,
  PERSONAL_NIGHTMARE,
);
