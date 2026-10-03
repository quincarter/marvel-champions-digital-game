import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { CRIME_ABILITIES } from "./crime.js";
import { FANTASY_ABILITIES } from "./fantasy.js";
import { HORROR_ABILITIES } from "./horror.js";
import { LONGSHOT_ABILITIES } from "./longshot.js";
import { MAGOG_ABILITIES } from "./magog.js";
import { MOJO_SCENARIO_ABILITIES } from "./mojo.js";
import { SCI_FI_ABILITIES } from "./sci-fi.js";
import { SITCOM_ABILITIES } from "./sitcom.js";
import { SPIRAL_ABILITIES } from "./spiral.js";
import { WESTERN_ABILITIES } from "./western.js";

/**
 * The MojoMania scenario pack's ability scripts (`mojo`, docs/phase7-wave6.md §7), one module per encounter set: the
 * six genre sets, the three scenarios' own sets and Longshot. Each module is filled in by its own scripting pass.
 */
export const MOJO_ABILITIES: AbilityRegistry = mergeRegistries(
  CRIME_ABILITIES,
  FANTASY_ABILITIES,
  HORROR_ABILITIES,
  SCI_FI_ABILITIES,
  SITCOM_ABILITIES,
  WESTERN_ABILITIES,
  MAGOG_ABILITIES,
  SPIRAL_ABILITIES,
  MOJO_SCENARIO_ABILITIES,
  LONGSHOT_ABILITIES,
);

export { CRIME_ABILITIES } from "./crime.js";
export { FANTASY_ABILITIES } from "./fantasy.js";
export { HORROR_ABILITIES } from "./horror.js";
export { LONGSHOT_ABILITIES } from "./longshot.js";
export { MAGOG_ABILITIES } from "./magog.js";
export { MOJO_SCENARIO_ABILITIES } from "./mojo.js";
export { SCI_FI_ABILITIES } from "./sci-fi.js";
export { SITCOM_ABILITIES } from "./sitcom.js";
export { SPIRAL_ABILITIES } from "./spiral.js";
export { WESTERN_ABILITIES } from "./western.js";
