import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { VALKYRIE_KIT } from "./valkyrie-kit.js";
import { VALKYRIE_OBLIGATION_NEMESIS } from "./valkyrie-obligation-nemesis.js";
import { VALKYRIE_PACK_CARDS } from "./valkyrie-pack-cards.js";

/** Every Valkyrie (`valk`) ability scripted directly (docs/phase7-wave4.md §3.22). */
export const VALK_ABILITIES: AbilityRegistry = mergeRegistries(
  VALKYRIE_KIT,
  VALKYRIE_OBLIGATION_NEMESIS,
  VALKYRIE_PACK_CARDS,
);
