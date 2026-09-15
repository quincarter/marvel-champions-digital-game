import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { THOR_KIT } from "./kit.js";
import { THOR_NEMESIS } from "./nemesis.js";
import { THOR_OBLIGATION } from "./obligation.js";
import { THOR_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Thor (`thor`) pack ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). This is the
 * ONE export `../index.ts` adds for this pack — see `docs/phase7-wave1-scripting.md`.
 *
 * Two ability refs are not included, both recorded beside their card in `pack-cards.ts`:
 * - Mean Swing (06015) needs a `TargetQuery` primitive that doesn't exist yet ("a Weapon upgrade on your hero").
 * - Valkyrie's Response (06012.valkyrie-response) needs a Response triggered by a card's own `cardEntersPlay` to
 *   see that same card's `paid.*` vars, which the engine doesn't thread through yet.
 * `wave1/coverage.test.ts` reports both unresolved, which is the correct, honest state until the primitives land.
 */
export const THOR_ABILITIES: AbilityRegistry = mergeRegistries(THOR_KIT, THOR_OBLIGATION, THOR_NEMESIS, THOR_PACK_CARDS);
