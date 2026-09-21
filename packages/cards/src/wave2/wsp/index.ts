import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { WASP_KIT } from "./kit.js";
import { WASP_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { WSP_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Wasp (`wsp`) ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). This is the ONE
 * export `../index.ts` adds for this pack — see `docs/phase7-wave2-scripting.md`.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): in progress.** Wasp's kit (`kit.ts`), obligation/nemesis
 * (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`) are scripted; every remaining
 * ref is a documented, primitive-blocked skip (three-sided-identity/divided-power reuse of Ant-Man's own landed
 * primitives, plus new gaps found scripting this pack) — see the coverage test's `KNOWN_SKIPPED.wsp` and each
 * module's own docblock for the exact list and reasons.
 */
export const WSP_ABILITIES: AbilityRegistry = mergeRegistries(WASP_KIT, WASP_OBLIGATION_NEMESIS, WSP_PACK_CARDS);
