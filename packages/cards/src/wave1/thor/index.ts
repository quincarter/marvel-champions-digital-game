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
 * One ability ref is not included, recorded beside its card in `pack-cards.ts`:
 * - Mean Swing (06015) needs a `TargetQuery` primitive that doesn't exist yet ("a Weapon upgrade on your hero").
 * `wave1/coverage.test.ts` reports it unresolved, which is the correct, honest state until the primitive lands.
 * Valkyrie's Response (06012.valkyrie-response) was the same kind of skip until the 2026-09-15 engine fix threaded
 * a card's own `paid.*` vars into a Response triggered by that same card's `cardEntersPlay`; it's now scripted.
 */
export const THOR_ABILITIES: AbilityRegistry = mergeRegistries(THOR_KIT, THOR_OBLIGATION, THOR_NEMESIS, THOR_PACK_CARDS);
