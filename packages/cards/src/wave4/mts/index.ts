import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { ADAM_WARLOCK_KIT } from "./adam-warlock-kit.js";
import { ADAM_WARLOCK_OBLIGATION_NEMESIS } from "./adam-warlock-obligation-nemesis.js";
import { ADAM_WARLOCK_PACK_CARDS } from "./adam-warlock-pack-cards.js";
import { SPECTRUM_KIT } from "./spectrum-kit.js";
import { SPECTRUM_OBLIGATION_NEMESIS } from "./spectrum-obligation-nemesis.js";
import { SPECTRUM_PACK_CARDS } from "./spectrum-pack-cards.js";

/**
 * Every Mad Titan's Shadow (`mts`) ability scripted directly (docs/phase7-wave4.md): Spectrum and Adam Warlock (both
 * heroes now scripted), then the box's scenarios/modulars/campaign in a later pass (§3, step 3 — see
 * `KNOWN_SKIPPED.mts` in `../coverage.test.ts`).
 */
export const MTS_ABILITIES: AbilityRegistry = mergeRegistries(
  SPECTRUM_KIT,
  SPECTRUM_PACK_CARDS,
  SPECTRUM_OBLIGATION_NEMESIS,
  ADAM_WARLOCK_KIT,
  ADAM_WARLOCK_PACK_CARDS,
  ADAM_WARLOCK_OBLIGATION_NEMESIS,
);
