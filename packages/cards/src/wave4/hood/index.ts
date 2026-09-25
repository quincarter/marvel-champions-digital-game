import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { HOOD } from "./hood.js";

/**
 * Every The Hood (`hood`) ability scripted directly (docs/phase7-wave4.md §2.3): the villain, the main scheme and
 * The Hood's own encounter set (`hood.ts`). The pack's nine modular sets, Standard II and Expert II are scripted in
 * a later pass — see `KNOWN_SKIPPED.hood` in `../coverage.test.ts`.
 */
export const HOOD_ABILITIES: AbilityRegistry = mergeRegistries(HOOD);
