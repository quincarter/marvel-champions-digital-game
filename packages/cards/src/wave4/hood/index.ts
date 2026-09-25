import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { BEASTY_BOYS } from "./beasty-boys.js";
import { BROTHERS_GRIMM } from "./brothers-grimm.js";
import { CROSSFIRE_CREW } from "./crossfire-crew.js";
import { HOOD } from "./hood.js";
import { RANSACKED_ARMORY } from "./ransacked-armory.js";
import { SINISTER_SYNDICATE } from "./sinister-syndicate.js";
import { MISTER_HYDE_SET } from "./mister-hyde.js";
import { STATE_OF_EMERGENCY } from "./state-of-emergency.js";
import { STREETS_OF_MAYHEM } from "./streets-of-mayhem.js";

/**
 * Every The Hood (`hood`) ability scripted directly (docs/phase7-wave4.md §2.3): the villain, the main scheme and
 * The Hood's own encounter set (`hood.ts`), then one file per modular set as each is scripted. Standard II and
 * Expert II are scripted in a later pass — see `KNOWN_SKIPPED.hood` in `../coverage.test.ts`.
 */
export const HOOD_ABILITIES: AbilityRegistry = mergeRegistries(
  HOOD,
  BEASTY_BOYS,
  BROTHERS_GRIMM,
  CROSSFIRE_CREW,
  MISTER_HYDE_SET,
  STATE_OF_EMERGENCY,
  STREETS_OF_MAYHEM,
  RANSACKED_ARMORY,
  SINISTER_SYNDICATE,
);
