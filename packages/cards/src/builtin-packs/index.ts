/**
 * Every product of the base game as a built-in pack (docs/builtin-content-packs.md): the Core Set, then waves 1 to
 * 11, each wave's packs in the order their scripts merge.
 */
import { CORE_BUILTIN_PACK } from "../core/pack.js";
import { WAVE1_BUILTIN_PACKS } from "../wave1/index.js";
import { WAVE2_BUILTIN_PACKS } from "../wave2/index.js";
import { WAVE3_BUILTIN_PACKS } from "../wave3/index.js";
import { WAVE4_BUILTIN_PACKS } from "../wave4/index.js";
import { WAVE5_BUILTIN_PACKS } from "../wave5/index.js";
import { WAVE6_BUILTIN_PACKS } from "../wave6/index.js";
import { WAVE7_BUILTIN_PACKS } from "../wave7/index.js";
import { WAVE8_BUILTIN_PACKS } from "../wave8/index.js";
import { WAVE9_BUILTIN_PACKS } from "../wave9/index.js";
import { WAVE10_BUILTIN_PACKS } from "../wave10/index.js";
import { WAVE11_BUILTIN_PACKS } from "../wave11/index.js";
import type { BuiltinPack } from "./define.js";

export const BUILTIN_PACKS: readonly BuiltinPack[] = [
  CORE_BUILTIN_PACK,
  ...WAVE1_BUILTIN_PACKS,
  ...WAVE2_BUILTIN_PACKS,
  ...WAVE3_BUILTIN_PACKS,
  ...WAVE4_BUILTIN_PACKS,
  ...WAVE5_BUILTIN_PACKS,
  ...WAVE6_BUILTIN_PACKS,
  ...WAVE7_BUILTIN_PACKS,
  ...WAVE8_BUILTIN_PACKS,
  ...WAVE9_BUILTIN_PACKS,
  ...WAVE10_BUILTIN_PACKS,
  ...WAVE11_BUILTIN_PACKS,
];
