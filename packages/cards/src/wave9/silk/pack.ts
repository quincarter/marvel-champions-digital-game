import { SILK_CARDS, SILK_ENCOUNTER_SETS, SILK_PACK, SILK_SCENARIOS, SILK_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
import { mergeRegistries } from "../../dsl/index.js";
import { SILK_ASPECT_BASIC } from "./aspect-basic.js";
import { GROWING_STRONG } from "./growing-strong.js";
import { SILK_EVENTS } from "./silk/events.js";
import { SILK_IDENTITY } from "./silk/identity.js";
import { SILK_OBLIGATION_NEMESIS } from "./silk/obligation-nemesis.js";
import { SILK_SUPPORT_UPGRADES_ALLIES } from "./silk/support-upgrades-allies.js";
import { SILK_QUICK_QUIP } from "../../wave5/silk/quick-quip.js";

/**
 * The `silk` product as a built-in pack: its cards and every script they need.
 *
 * The Silk hero pack (with the Growing Strong modular set), scripted from per-group modules. See docs/phase7-wave9.md.
 *
 * Quick Quip (52034) was scripted in wave 5 (`SILK_QUICK_QUIP`, `../../wave5/silk/quick-quip.ts`), ahead of this
 * pack, and wave 5's registry still merges it at that point. This pack holds it too, so it carries every script of its
 * cards (`./aspect-basic.ts` skips 52034); wave 9 merges the pack less that script (`ownScriptsOf`) so the id is not
 * defined twice.
 */
export const SILK_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "silk", kind: "hero", name: SILK_PACK.name, product: SILK_PACK },
  cards: SILK_CARDS,
  encounterSets: SILK_ENCOUNTER_SETS,
  scenarios: SILK_SCENARIOS,
  decks: SILK_STARTER_DECKS,
  abilities: mergeRegistries(
    SILK_ASPECT_BASIC,
    GROWING_STRONG,
    SILK_EVENTS,
    SILK_IDENTITY,
    SILK_OBLIGATION_NEMESIS,
    SILK_SUPPORT_UPGRADES_ALLIES,
    SILK_QUICK_QUIP,
  ),
});
