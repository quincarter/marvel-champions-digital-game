import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  anEnemy,
  attackedThisPhase,
  chooseOne,
  chosen,
  confuse,
  constant,
  dealDamage,
  defenderDefForAttack,
  defineAbilities,
  enemyAttack,
  eventDealt,
  eventSource,
  eventTarget,
  exhaustThis,
  forcedInterrupt,
  gainKeywordUntil,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  modifyAttack,
  modifyConsequentialDamage,
  modifyStat,
  on,
  option,
  query,
  response,
  retargetAttack,
  self,
  stun,
  when,
  you,
  YOUR_HERO,
  yourIdentity,
} from "../../dsl/index.js";
import { WAVE10_ABILITIES } from "../../wave10/index.js";

/**
 * Wave 11 scripting module `iron_fist/protection` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (8):
 * - 64013 Helpful Bystander (ally)
 * - 64014 Iron Fist (ally)
 * - 64015 Defiance (event)
 * - 64016 Demoralize (event)
 * - 64017 The Night Nurse (support)
 * - 64018 Redirection Mastery (upgrade)
 * - 64019 No Time to Bleed (upgrade)
 * - 64020 Tonfa (upgrade)
 *
 * Reprints, aliased to the original card's script: 64015, 64017.
 *
 * **64013.helpful-bystander-constant**: "Your hero gets +1 hand size" (hero form only). Vulnerable is data (the engine's
 * keyword rule, RRG 1.8 p. 48).
 *
 * **64013.helpful-bystander-forced-interrupt**: Amadeus Cho's shape (hercules 59008) for any enemy. The attack is the
 * same attack redirected (`retargetAttack`): "when it attacks" does not fire again, the ally's controller is the
 * attacked player (wave 7 section 4.1 Q16 A), and the attack gains overkill (RRG 1.8 p. 31). It can still be defended
 * (p. 10); "attacks you" is the attacked player (RRG 1.8 "Attack", p. 8; "You, Your", p. 49).
 *
 * **64014.iron-fist-response**: "an enemy who has been attacked by a hero this phase" reads the phase's attack record
 * (`attackedThisPhase`), the attacker as it was when it attacked, so a hero who has since changed form still counts; his
 * own attack is an ally's, not a hero's. Optional, so both sentences come with the response. "If Iron Fist defeated that
 * enemy" is the attack's `defeated` (a plain defeat, not "exactly"); "-2 consequential damage from this attack" changes
 * the pending consequential damage of this attack (`modifyConsequentialDamage`), which resolves after the attack's
 * responses (RRG 1.8 "Consequential Damage", p. 13). Stunning a defeated enemy does nothing.
 *
 * **64016.demoralize-action**: any enemy, engaged or not, attacks you; then it is confused. Not an attack by you, so
 * no label and no guard.
 *
 * **64018.redirection-mastery-response**: "you" is the upgrade's controller, whoever's play area it is in, so "you
 * exactly defend" is that player's hero (`after.exactlyDefends`): a basic defense whose modified DEF equals the attack's
 * modified ATK, boost icons included, with no prevention or reduction (FFG ruling September 10, 2026 (4)); a "(defense)"
 * ability alone is no basic defense (October 12, 2026 (4)). The damage is the hero's DEF for that attack
 * (`defenderDefForAttack`), to the attacking enemy. With The Best Defense (ATK used instead of DEF), the ATK stands in
 * for "your DEF" both in the comparison and in the damage: owner decision 8 (phase7-elektra-iron-fist §5).
 * Max 1 per player and any-player control are data.
 *
 * **64019.no-time-to-bleed-response**: "After you play a card (including this one)" is `youPlayedCard` for any card
 * (Move in Shadow's shape, fne 60027); the heal is from your identity, so it works in either form. Discount is data;
 * Temporary is the keyword (RRG 1.8 p. 44: discarded when the round ends).
 *
 * **64020.tonfa-interrupt**: "When calculating damage during an attack against you" is the attack's damage step
 * (`enemyAttacks({ atDamage: true })`). The player picks one: +1 DEF or retaliate 1, each until the attack ends. A
 * hero in alter-ego form has no Hero Interrupt to trigger.
 */
export const IRON_FIST_PROTECTION: AbilityRegistry = defineAbilities({
  "64013.helpful-bystander-constant": constant(gets("handSize", 1, YOUR_HERO)),
  "64013.helpful-bystander-forced-interrupt": forcedInterrupt(
    on.enemyAttacks(query("enemy"), { againstYou: true }),
    retargetAttack(self),
    modifyAttack({ overkill: true }),
  ),

  "64014.iron-fist-response": response(
    after.attacks("self", { target: query("enemy") }),
    { while: attackedThisPhase(eventTarget, { category: "hero" }) },
    stun(eventTarget),
    ifThen(eventDealt("defeated"), modifyConsequentialDamage(-2, self)),
  ),

  "64015.defiance-interrupt": WAVE10_ABILITIES["26018.defiance-interrupt"]!,

  "64016.demoralize-action": heroAction(
    anEnemy("enemy"),
    enemyAttack(chosen("enemy"), { against: you }),
    confuse(chosen("enemy")),
  ),

  "64017.the-night-nurse-action": WAVE10_ABILITIES["09019.the-night-nurse-action"]!,

  "64018.redirection-mastery-response": heroResponse(
    after.exactlyDefends(YOUR_HERO),
    dealDamage(defenderDefForAttack, eventSource),
  ),

  "64019.no-time-to-bleed-response": response(after.youPlayedCard(query([])), heal(1, yourIdentity)),

  "64020.tonfa-interrupt": heroInterrupt(
    when.enemyAttacks(query("enemy"), { againstYou: true, atDamage: true }),
    { cost: exhaustThis },
    chooseOne(
      option("+1 DEF for this attack", modifyStat("def", 1, yourIdentity, "endOfAttack")),
      option(
        "Retaliate 1 for this attack",
        gainKeywordUntil({ name: "retaliate", value: 1 }, yourIdentity, "endOfAttack"),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_PROTECTION_SKIPPED: Readonly<Record<string, string>> = {};
