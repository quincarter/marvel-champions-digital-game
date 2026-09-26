import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { NEBULA_KIT } from "./nebula-kit.js";
import { NEBULA_OBLIGATION_NEMESIS } from "./nebula-obligation-nemesis.js";
import { NEBULA_PACK_CARDS } from "./nebula-pack-cards.js";

/** Every Nebula (`nebu`) ability scripted directly (docs/phase7-wave4.md). */
export const NEBU_ABILITIES: AbilityRegistry = mergeRegistries(
  NEBULA_KIT,
  NEBULA_OBLIGATION_NEMESIS,
  NEBULA_PACK_CARDS,
);
