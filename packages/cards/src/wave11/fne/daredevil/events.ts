import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  aScheme,
  alterEgoAction,
  anAttackableEnemy,
  attack,
  chooseNumber,
  chosen,
  countOf,
  dealDamage,
  defineAbilities,
  each,
  heroAction,
  hasTrait,
  ifElse,
  playFromSeparateDeck,
  query,
  scaled,
  sum,
  thwart,
  varOf,
  yourIdentity,
} from "../../../dsl/index.js";

/** "Each upgrade attached to" a card: the upgrades whose host is `of`. */
const upgradesOn = (of: ReturnType<typeof chosen>) => countOf(query("upgrade", { host: of }));

/**
 * Wave 11 scripting module `fne/daredevil/events` (docs/phase7-wave11.md section 8.4 line 3).
 *
 * Cards (4):
 * - 60008 Cross-Examination (event)
 * - 60009 Deposition (event)
 * - 60010 Living Lie Detector (event)
 * - 60011 Raising Hell (event)
 *
 * **60008.cross-examination-action**, Hero Action (attack): an attack of 3 on an enemy he may attack, plus 1 for each
 * upgrade on that enemy that he chooses ("you may ... for each": a number from 0 to the count, asked after the enemy is
 * chosen). One attack of the summed amount, so "additional damage" modifiers (Aggressive Energy) add once.
 *
 * **60009.deposition-action**, Alter-Ego Action (thwart): "You may choose any upgrade from the Sense deck and play it,
 * ignoring its resource cost. (Do not shuffle.) Remove 2 threat from a scheme." The play is a play (section 3.2: form,
 * unique and max apply, the host is asked) and optional; the Sense deck is in fixed order so nothing shuffles.
 * Declining or having no legal upgrade still removes the threat. The removal is a thwart (RRG 1.8 "Labeled Ability",
 * p. 26).
 *
 * **60010.living-lie-detector-action**, Action (thwart): a thwart of 2 on a scheme, plus 1 for each upgrade on that
 * scheme that he chooses (0 to the count).
 *
 * **60011.raising-hell-action**, Hero Action (attack): 2 damage (3 if Daredevil has the Aerial trait) to each enemy
 * for each upgrade attached to that enemy. One attack (RRG 1.8 "Attack (Player Ability Type)", p. 10; wave 8 Q47/Q48).
 * Owner question 1 (section 4.1, default A, open): an enemy with no upgrades is not attacked (no damage instruction
 * names it), so only enemies with an upgrade are targeted. June 25, 2026 R2: Aggressive Energy adds +1 to each enemy
 * it damages (2 upgrades: 4 + 1), which the per-target damage supports.
 */
export const FNE_DAREDEVIL_EVENTS: AbilityRegistry = defineAbilities({
  "60008.cross-examination-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    chooseNumber("extra", upgradesOn(chosen("enemy"))),
    attack(sum(3, varOf("extra.amount")), chosen("enemy")),
  ),

  "60009.deposition-action": alterEgoAction(
    { label: "thwart" },
    playFromSeparateDeck("Sense", "any", { ignoreCost: true, filter: query("upgrade"), optional: true }),
    aScheme("scheme"),
    thwart(2, chosen("scheme")),
  ),

  "60010.living-lie-detector-action": action(
    { label: "thwart" },
    aScheme("scheme"),
    chooseNumber("extra", upgradesOn(chosen("scheme"))),
    thwart(sum(2, varOf("extra.amount")), chosen("scheme")),
  ),

  "60011.raising-hell-action": heroAction(
    { label: "attack" },
    dealDamage(
      ifElse(
        hasTrait(yourIdentity, trait("AERIAL")),
        scaled(upgradesOn(chosen("affected")), { times: 3 }),
        scaled(upgradesOn(chosen("affected")), { times: 2 }),
      ),
      each(query("enemy", { hasAttachment: query("upgrade") })),
      { perTarget: true },
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_DAREDEVIL_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
