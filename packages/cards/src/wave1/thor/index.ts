import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { THOR_KIT } from "./kit.js";
import { THOR_NEMESIS } from "./nemesis.js";
import { THOR_OBLIGATION } from "./obligation.js";
import { THOR_PACK_CARDS } from "./pack-cards.js";

/**
 * Every Thor (`thor`) pack ability scripted directly (i.e. not a reprint aliased by `../reprints.ts`). This is the
 * ONE export `../index.ts` adds for this pack — see `docs/phase7-wave1-scripting.md`. Every ability ref for this
 * pack now resolves — 0 skips.
 *
 * Valkyrie's Response (06012.valkyrie-response) was a skip until the 2026-09-15 engine fix threaded a card's own
 * `paid.*` vars into a Response triggered by that same card's `cardEntersPlay`. Mean Swing (06015) was a skip until
 * the wave B primitives batch landed `TargetQuery.host` ("a Weapon upgrade on your hero"); both are scripted now
 * (`pack-cards.ts`).
 */
export const THOR_ABILITIES: AbilityRegistry = mergeRegistries(
  THOR_KIT,
  THOR_OBLIGATION,
  THOR_NEMESIS,
  THOR_PACK_CARDS,
);
