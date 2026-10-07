import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  boost,
  chooseTarget,
  chosen,
  confuse,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  discardEncounterUntil,
  each,
  forcedResponse,
  gainsKeyword,
  on,
  placeThreat,
  query,
  revealCard,
  stun,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";

const DARK_RIDERS_MINION = query("minion", { trait: trait("DARK RIDERS") });
const AFTER_ATTACKS_YOU = on.enemyAttacks("self", { againstYou: true });

/**
 * Modular encounter set `dark_riders` (Age of Apocalypse, docs/phase7-wave8.md §2.10, §3.32, §8.4): five unique Dark
 * Riders minions and The Dark Riders side scheme. Teamwork (Dark Riders) and Hinder 1 per hero are data keywords
 * (wave 6 §3.1; Tusk prints SCH 0). Every Forced Response answers an attack against "you", the player the minion is
 * engaged with. The scheme's toughness is a keyword grant read while it is in play, so a minion that enters later gets
 * the tough status card too; its When Revealed is the same discard-until-and-reveal as Mutant Terrorists.
 *
 * Cards (6):
 * - 45112 Gauntlet (minion)
 * - 45113 Barrage (minion)
 * - 45114 Hard-Drive (minion)
 * - 45115 Tusk (minion)
 * - 45116 Psynapse (minion)
 * - 45117 The Dark Riders (side_scheme)
 */
export const DARK_RIDERS: AbilityRegistry = defineAbilities({
  // Gauntlet — Forced Response: After Gauntlet attacks you, discard an upgrade you control. (You choose it.)
  "45112.gauntlet-forced-response": forcedResponse(
    AFTER_ATTACKS_YOU,
    chooseTarget("upgrade", query("upgrade", { controller: "you" })),
    discard(chosen("upgrade")),
  ),

  // Barrage — Forced Response: After Barrage attacks you, deal 1 damage to each character you control.
  "45113.barrage-forced-response": forcedResponse(
    AFTER_ATTACKS_YOU,
    dealDamage(1, each(query("character", { controller: "you" }))),
  ),

  // Hard-Drive — Forced Response: After Hard-Drive attacks you, place 1 threat on each scheme.
  "45114.hard-drive-forced-response": forcedResponse(AFTER_ATTACKS_YOU, placeThreat(1, each(query("scheme")))),

  // Tusk — Forced Response: After Tusk attacks you, you are stunned. Boost: You are stunned.
  "45115.tusk-forced-response": forcedResponse(AFTER_ATTACKS_YOU, stun(yourIdentity)),
  "45115.boost": boost(stun(yourIdentity)),

  // Psynapse — Forced Response: After Psynapse attacks you, you are confused. Boost: You are confused.
  "45116.psynapse-forced-response": forcedResponse(AFTER_ATTACKS_YOU, confuse(yourIdentity)),
  "45116.boost": boost(confuse(yourIdentity)),

  // The Dark Riders — Each Dark Riders minion gains toughness.
  "45117.the-dark-riders-constant": constant(gainsKeyword({ name: "toughness" }, DARK_RIDERS_MINION)),
  // When Revealed: Discard cards from the encounter deck until a Dark Riders minion is discarded and reveal it.
  "45117.when-revealed": whenRevealed(discardEncounterUntil(DARK_RIDERS_MINION, "rider"), revealCard(chosen("rider"))),
});
