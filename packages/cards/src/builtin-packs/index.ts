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

/**
 * The set codes of the products the game doesn't offer yet (`BuiltinPackManifest.status`, `"not-ready"`). Their cards
 * are in the pool, but their heroes stay out of hero select, the deck builder's identity list and the precons, and a
 * deck led by one of them can't be seated. A pack leaves this set when its `status` is deleted.
 * Matching a card's `setCode` against a manifest id is safe: `defineBuiltinPack` refuses a pack holding a card of
 * another set code.
 */
export const NOT_READY_PACK_CODES: ReadonlySet<string> = new Set(
  BUILTIN_PACKS.filter((pack) => pack.manifest.status === "not-ready").map((pack) => pack.manifest.id),
);

/** Whether a card (a hero identity, say) belongs to a product the game doesn't offer yet. */
export const isNotReadyCard = (card: { readonly setCode: string }): boolean => NOT_READY_PACK_CODES.has(card.setCode);
