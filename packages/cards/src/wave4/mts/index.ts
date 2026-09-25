import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { ADAM_WARLOCK_KIT } from "./adam-warlock-kit.js";
import { ADAM_WARLOCK_OBLIGATION_NEMESIS } from "./adam-warlock-obligation-nemesis.js";
import { ADAM_WARLOCK_PACK_CARDS } from "./adam-warlock-pack-cards.js";
import { EBONY_MAW } from "./ebony-maw.js";
import { FROST_GIANTS } from "./frost-giants.js";
import { HELA } from "./hela.js";
import { INFINITY_GAUNTLET } from "./infinity-gauntlet.js";
import { LEGIONS_OF_HEL } from "./legions-of-hel.js";
import { SPECTRUM_KIT } from "./spectrum-kit.js";
import { SPECTRUM_OBLIGATION_NEMESIS } from "./spectrum-obligation-nemesis.js";
import { SPECTRUM_PACK_CARDS } from "./spectrum-pack-cards.js";
import { THANOS } from "./thanos.js";
import { TOWER_DEFENSE } from "./tower-defense.js";

/**
 * Every Mad Titan's Shadow (`mts`) ability scripted directly (docs/phase7-wave4.md): Spectrum and Adam Warlock (both
 * heroes now scripted), Ebony Maw (the box's first scenario, `ebony-maw.ts`), Tower Defense (its second,
 * `tower-defense.ts`), Thanos (its third, `thanos.ts` plus its own Infinity Gauntlet modular set,
 * `infinity-gauntlet.ts`) and Hela (its fourth, `hela.ts`, plus the two modular sets it recommends, `legions-of-
 * hel.ts` and `frost-giants.ts` — the latter also reused by the Loki scenario), then the box's remaining
 * scenarios/campaign in a later pass (§3, step 3 — see `KNOWN_SKIPPED.mts` in `../coverage.test.ts`).
 */
export const MTS_ABILITIES: AbilityRegistry = mergeRegistries(
  SPECTRUM_KIT,
  SPECTRUM_PACK_CARDS,
  SPECTRUM_OBLIGATION_NEMESIS,
  ADAM_WARLOCK_KIT,
  ADAM_WARLOCK_PACK_CARDS,
  ADAM_WARLOCK_OBLIGATION_NEMESIS,
  EBONY_MAW,
  TOWER_DEFENSE,
  THANOS,
  INFINITY_GAUNTLET,
  HELA,
  LEGIONS_OF_HEL,
  FROST_GIANTS,
);
