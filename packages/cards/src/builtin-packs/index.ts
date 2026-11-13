/**
 * The products defined as built-in packs so far (docs/custom-content-packs.md §11.2; the retrofit runs one product at
 * a time): the Core Set, then waves 1, 2 and 3, each in the order its scripts merge. Later waves still assemble
 * their registries directly and join this list as they move.
 */
import { CORE_BUILTIN_PACK } from "../core/pack.js";
import { WAVE1_BUILTIN_PACKS } from "../wave1/index.js";
import { WAVE2_BUILTIN_PACKS } from "../wave2/index.js";
import { WAVE3_BUILTIN_PACKS } from "../wave3/index.js";
import type { BuiltinPack } from "./define.js";

export const BUILTIN_PACKS: readonly BuiltinPack[] = [
  CORE_BUILTIN_PACK,
  ...WAVE1_BUILTIN_PACKS,
  ...WAVE2_BUILTIN_PACKS,
  ...WAVE3_BUILTIN_PACKS,
];
