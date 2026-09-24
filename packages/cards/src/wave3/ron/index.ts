import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { KREE_FANATIC } from "./kree-fanatic.js";

/** Every `ron` (Kree Fanatic modular encounter set) ability scripted directly. See docs/phase7-wave3.md §2.3. */
export const RON_ABILITIES: AbilityRegistry = mergeRegistries(KREE_FANATIC);
