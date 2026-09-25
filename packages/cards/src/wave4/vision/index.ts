import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { VISION_KIT } from "./vision-kit.js";
import { VISION_OBLIGATION_NEMESIS } from "./vision-obligation-nemesis.js";
import { VISION_PACK_CARDS } from "./vision-pack-cards.js";

/** Every Vision (`vision`) ability scripted directly (docs/phase7-wave4.md). Reprints (Indomitable, Side Step, Get
 * Behind Me!, Avengers Mansion, Ultron Drones) are supplied by `../reprints.ts`, merged in ahead of this in
 * `../index.ts`. */
export const VISION_ABILITIES: AbilityRegistry = mergeRegistries(
  VISION_KIT,
  VISION_OBLIGATION_NEMESIS,
  VISION_PACK_CARDS,
);
