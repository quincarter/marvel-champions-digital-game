import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { SCW_KIT } from "./kit.js";
import { SCW_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { SCW_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Scarlet Witch (`scw`) ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). This is
 * the ONE export `../index.ts` adds for this pack — see `docs/phase7-wave2-scripting.md`.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): fully scripted, `KNOWN_SKIPPED.scw` empty.** Scarlet
 * Witch's kit (`kit.ts`), obligation/nemesis (`obligation-nemesis.ts`) and the pack's own generic-aspect cards
 * (`pack-cards.ts`) are scripted; `15023.obligation` (Slipping Sanity) landed once `card-data-pipeline` added a
 * printed `starIcon` field — see `obligation-nemesis.ts`'s own docblock.
 */
export const SCW_ABILITIES: AbilityRegistry = mergeRegistries(SCW_KIT, SCW_OBLIGATION_NEMESIS, SCW_PACK_CARDS);
