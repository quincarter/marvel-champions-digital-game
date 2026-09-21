import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { QSV_KIT } from "./kit.js";
import { QUICKSILVER_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { QSV_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Quicksilver (`qsv`) ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). This is
 * the ONE export `../index.ts` adds for this pack — see `docs/phase7-wave2-scripting.md`.
 *
 * **Status (docs/phase7-wave2-scripting.md "Progress"): scripted.** Quicksilver's kit (`kit.ts`), obligation/
 * nemesis (`obligation-nemesis.ts`) and the pack's own generic-aspect cards (`pack-cards.ts`) are scripted; every
 * remaining ref is a documented, primitive- or data-blocked skip — see the coverage test's `KNOWN_SKIPPED.qsv` and
 * each module's own docblock for the exact list and reasons.
 */
export const QSV_ABILITIES: AbilityRegistry = mergeRegistries(QSV_KIT, QUICKSILVER_OBLIGATION_NEMESIS, QSV_PACK_CARDS);
