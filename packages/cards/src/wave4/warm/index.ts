import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { WAR_MACHINE_KIT } from "./war-machine-kit.js";
import { WAR_MACHINE_OBLIGATION_NEMESIS } from "./war-machine-obligation-nemesis.js";
import { WAR_MACHINE_PACK_CARDS } from "./war-machine-pack-cards.js";

/** Every War Machine (`warm`) ability scripted directly (docs/phase7-wave4.md). */
export const WARM_ABILITIES: AbilityRegistry = mergeRegistries(
  WAR_MACHINE_KIT,
  WAR_MACHINE_OBLIGATION_NEMESIS,
  WAR_MACHINE_PACK_CARDS,
);
