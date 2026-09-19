import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { ANT_MAN_KIT } from "./kit.js";
import { ANT_MAN_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { ANT_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Ant-Man (`ant`) ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). This is the
 * ONE export `../index.ts` adds for this pack — see `docs/phase7-wave2-scripting.md`.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): scripted.** Ant-Man's kit (`kit.ts`), obligation/nemesis
 * (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`) are scripted; every remaining
 * ref is a documented, primitive-blocked (or, for Yellowjacket's two form-conditional constants, a found-by-testing
 * engine-crash) skip — see the coverage test's `KNOWN_SKIPPED.ant` and each module's own docblock for the exact
 * list and reasons.
 */
export const ANT_ABILITIES: AbilityRegistry = mergeRegistries(ANT_MAN_KIT, ANT_MAN_OBLIGATION_NEMESIS, ANT_PACK_CARDS);
