import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { ABSORBING_MAN_SET } from "./absorbing-man.js";
import { CROSSBONES_SET } from "./crossbones.js";
import { HAWKEYE_KIT } from "./hawkeye-kit.js";
import { HAWKEYE_OBLIGATION_NEMESIS } from "./hawkeye-obligation-nemesis.js";
import { SPIDER_WOMAN_KIT } from "./spider-woman-kit.js";
import { SPIDER_WOMAN_OBLIGATION_NEMESIS } from "./spider-woman-obligation-nemesis.js";
import { RED_SKULL_SET } from "./red-skull.js";
import { TASKMASTER_SET } from "./taskmaster.js";
import { ZOLA_SET } from "./zola.js";

/**
 * Every The Rise of Red Skull (`trors`) ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`).
 * This is the ONE export `../index.ts` adds for this pack — see `docs/phase7-wave2-scripting.md`.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): in progress.** Hawkeye and Spider-Woman's own kits,
 * obligations and nemesis sets are scripted (each with a handful of documented, primitive-blocked skips). The
 * Crossbones scenario's villain, main scheme and its own encounter set are scripted; Absorbing Man, Taskmaster,
 * Zola, Red Skull and the pack's own generic-aspect filler cards (`pack-cards.ts`, docs/phase7-wave1-scripting.md
 * §1's convention) are not started yet — see the coverage test's `KNOWN_SKIPPED.trors` for the exact remaining ids.
 */
export const TRORS_ABILITIES: AbilityRegistry = mergeRegistries(
  HAWKEYE_KIT,
  HAWKEYE_OBLIGATION_NEMESIS,
  SPIDER_WOMAN_KIT,
  SPIDER_WOMAN_OBLIGATION_NEMESIS,
  CROSSBONES_SET,
  ABSORBING_MAN_SET,
  TASKMASTER_SET,
  ZOLA_SET,
  RED_SKULL_SET,
);
