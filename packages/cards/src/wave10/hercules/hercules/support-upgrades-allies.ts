import type { AbilityRegistry } from "@mc/engine";
import {
  YOUR_HERO,
  YOUR_IDENTITY,
  action,
  after,
  defineAbilities,
  draw,
  eventResult,
  exhaustThis,
  forcedInterrupt,
  gainKeywordUntil,
  generatesAmount,
  gets,
  constant,
  heal,
  heroInterrupt,
  heroResponse,
  modifyAttack,
  modifyStat,
  on,
  query,
  repeatTimes,
  resource,
  retargetAttack,
  self,
  when,
  yourIdentity,
} from "../../../dsl/index.js";
import { giftCardsYouControl } from "./identity.js";

/**
 * Wave 10 scripting module `hercules/hercules/support-upgrades-allies` (docs/phase7-wave10-hero-packs.md H3.8, H3.9,
 * H3.21, H8.4 line HS12).
 *
 * Cards (7):
 * - 59008 Amadeus Cho (ally)
 * - 59012 Olympus (support)
 * - 59013 Gauntlets of Hercules (upgrade)
 * - 59014 Golden Mace (upgrade)
 * - 59015 Herc's Helm (upgrade)
 * - 59016 Lion of Olympus (upgrade)
 * - 59017 Prince of Power (upgrade)
 *
 * Every count of "Gift cards you control" is the shared `giftCardsYouControl` of the identity module, which reads 0
 * while Appeal to Athena is in the player's play area. The Restricted keyword (Golden Mace) and Temporary (Lion of
 * Olympus) are data.
 *
 * **59008.amadeus-cho-forced-interrupt**: "When a minion would attack you, it attacks Amadeus Cho instead." The attack
 * is retargeted as it is initiated (the same instruction as Protect Humanity's), so Cho is the attacked character and
 * may be defended like any attack on an ally (RRG 1.8 "Attacks Against Allies", p. 10); an attack on another player,
 * or on Cho himself, is not redirected, and the villain's own attacks are Protect Humanity's business. **59008.amadeus-cho-action**:
 * "Action: Exhaust Amadeus Cho -> draw 1 card."
 *
 * **59012.olympus-resource**: "Resource: Exhaust Olympus -> generate a [wild] resource for each Gift card you control."
 * One generation of that many wild resources, so it is nothing with no Gift card (or with Appeal to Athena in play).
 *
 * **59013.gauntlets-of-hercules-interrupt**: "Hero Interrupt: When Hercules defends against an attack, exhaust Gauntlets
 * of Hercules -> Hercules gains retaliate 1 for that attack for each Gift card you control." One grant of retaliate 1
 * per Gift card, each lasting to the end of the attack, so the instances add together (RRG 1.8 "Keywords", p. 25) and
 * stack with Shield of Perseus's own retaliate 1.
 *
 * **59014.golden-mace-interrupt**: "Hero Interrupt: When Hercules makes a basic attack, exhaust Golden Mace -> Hercules
 * gets +1 ATK for this attack for each Gift card you control. This attack gains overkill." February 8, 2026 - Ruling 2:
 * the bonus is part of the ATK that is dealt; against a minion that reduces damage taken the excess spills as overkill
 * on the amount taken.
 *
 * **59015.hercs-helm-interrupt**: "Hero Interrupt (defense): When the villain attacks, exhaust Herc's Helm -> reduce the
 * amount of damage this attack deals by 1." Read as 1 less ATK on the attack (`modifyAttack({ atkBonus: -1 })`), so the
 * amount is reduced before the defender's DEF and a tough status card (no damage then no tough used); the label makes
 * Hercules the defender of the attack when nobody has defended (RRG 1.8 "Defend, Defense", p. 15).
 *
 * **59016.lion-of-olympus-constant**: "Your hero gets +1 THW, +1 ATK, and +1 DEF." Hero form only (your hero).
 *
 * **59017.prince-of-power-response**: "Hero Response: After Hercules attacks and defeats an enemy, exhaust Prince of
 * Power -> heal 1 damage from Hercules for each point of excess damage dealt to that enemy by that attack." The excess
 * is the damage **taken** past the enemy's remaining hit points, the amount overkill spills (RRG 1.8 "Overkill", p. 31).
 * That supersedes February 8, 2026 - Ruling 2 (which counted the damage dealt, 3 healed in its Thumbelina example)
 * under the user's order of rules authority (2026-10-16, CLAUDE.md): the latest RRG wins where an earlier ruling
 * conflicts with it. 6 dealt to a 3-hit-point minion that takes 1 less is 5 taken, 2 overkill and 2 healed. This
 * replaces owner answer 31B (2026-10-12, docs/phase7-wave10.md §4.0).
 */
export const HERCULES_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "59008.amadeus-cho-forced-interrupt": forcedInterrupt(
    on.enemyAttacks(query("minion"), { againstYou: true }),
    retargetAttack(self),
  ),
  "59008.amadeus-cho-action": action({ cost: exhaustThis }, draw(1)),

  "59012.olympus-resource": resource(generatesAmount("wild", giftCardsYouControl), { cost: exhaustThis }),

  "59013.gauntlets-of-hercules-interrupt": heroInterrupt(
    when.defends(YOUR_HERO),
    { cost: exhaustThis },
    repeatTimes(giftCardsYouControl, gainKeywordUntil({ name: "retaliate", value: 1 }, yourIdentity, "endOfAttack")),
  ),

  "59014.golden-mace-interrupt": heroInterrupt(
    when.attacks(YOUR_HERO, { basic: true }),
    { cost: exhaustThis },
    modifyStat("atk", giftCardsYouControl, yourIdentity, "endOfAttack"),
    modifyAttack({ keywords: ["overkill"] }),
  ),

  "59015.hercs-helm-interrupt": heroInterrupt(
    on.villainAttacks(),
    { label: "defense", cost: exhaustThis },
    modifyAttack({ atkBonus: -1 }),
  ),

  "59016.lion-of-olympus-constant": constant(
    gets("thw", 1, YOUR_HERO),
    gets("atk", 1, YOUR_HERO),
    gets("def", 1, YOUR_HERO),
  ),

  "59017.prince-of-power-response": heroResponse(
    after.attacks(YOUR_IDENTITY, { defeats: true }),
    { cost: exhaustThis },
    heal(eventResult("excessDealt"), yourIdentity),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const HERCULES_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
