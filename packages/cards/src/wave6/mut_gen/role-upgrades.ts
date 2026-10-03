import { trait } from "@mc/content";
import {
  alterEgoResponse,
  anEnemy,
  applyRuleUntil,
  attack,
  attackAnEnemy,
  cards,
  chooseTarget,
  chosen,
  confuse,
  defineAbilities,
  divide,
  eventSource,
  draw,
  each,
  giveTough,
  heal,
  heroAction,
  heroInterrupt,
  heroResource,
  heroResponse,
  modifyAttack,
  modifyBasicPower,
  moveCards,
  on,
  preventConsequentialDamage,
  query,
  ready,
  removeFromCampaign,
  self,
  spend,
  stun,
  theMainScheme,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../dsl/index.js";

const ATTACK = trait("ATTACK");
const DEFENSE = trait("DEFENSE");
const TACTIC = trait("TACTIC");
const THWART = trait("THWART");

/** "Remove this card from the game and the campaign pool." (RRG 1.8 p. 29: the removal outlasts a lost game.) */
const REMOVE_THIS_CARD = [removeFromCampaign(cards(self)), moveCards(cards(self), "removedFromGame")] as const;

/** "When an enemy attacks": any enemy's attack against any player, as it is initiated (RRG 1.8 "Interrupt", p. 25). */
const AN_ENEMY_ATTACKS = on.enemyAttacks(query("enemy"));
/** "When you make a basic defense": your identity uses its DEF, before the value is read (RRG 1.8 "Basic Power", p. 10). */
const MAKE_A_BASIC_DEFENSE = on.basicPowerUsing(YOUR_IDENTITY, { power: "defense" });
/** "When you defend against an attack": your identity defends, by a basic defense or a "(defense)" ability (p. 15). */
const YOU_DEFEND = on.defends(YOUR_IDENTITY);
/** "When you attack": an attack by your identity, basic or "(attack)", from an ability or an event. */
const YOU_ATTACK = on.attacks(YOUR_IDENTITY);
/** "After you recover": your identity's basic recovery, once it has resolved (docs/phase7-wave6.md §3.40, §4.1 Q20). */
const YOU_RECOVER = { ...on.basicPowerUsed(YOUR_IDENTITY), eventIs: { power: "recover" } } as const;
/** "Generate [wild][wild] resources for a <trait> or <trait> event". */
const wildPairFor = (first: ReturnType<typeof trait>, second: ReturnType<typeof trait>) =>
  [{ wild: 2 }, { generatesFor: query("event", { anyTrait: [first, second] }) }] as const;

/**
 * The Mutant Genesis role upgrades (`brawler`, `commander`, `defender`, `peacekeeper`; 32176-32195, MC32 p. 5): five
 * campaign-only upgrades per role, put into play at setup by `campaigns/mut_gen.ts` (a role upgrade the campaign deals
 * between games; a standalone deck cannot hold them, `specificTo: campaign`). Each prints "Remove this card from the
 * game and the campaign pool", an in-game `removeFromCampaign` plus `removedFromGame`. A used upgrade's removal
 * survives a lost game and an unused one is redealt (docs/phase7-wave6.md §4.1 Q12), both done by the campaign runner.
 *
 * All twenty are scripted: Coup de Grace (32176, 32181), Swagger (32177, 32186), Brazen Defense (32178), Ferocious
 * Attack (32179), War Cry (32180), Group Assault (32183), Shock and Awe (32184), Improvisation (32185), Surprise!
 * (32187, 32191), Heroic Intervention (32188), Determined Defense (32189), Compassion (32182, 32192), Bodyguard
 * (32190), Rescue Operation (32193), Mentorship (32194) and Fortitude (32195).
 *
 * - **Coup de Grace**: "this attack deals 3 additional damage" is `modifyAttack({ extraDamage })` on the attack in
 *   progress (docs/phase7-wave6.md §3.29), so a basic attack, an "(attack)" ability and an attack event alike take it.
 * - **Brazen Defense**: Shadow and Steel's shape (`precon-player-cards.ts`) with "prevent 3 damage from this attack" as
 *   `modifyAttack({ preventDamage: 3 })` (docs/phase7-wave6.md §3.81): set at initiation, spent on the damage the
 *   attack deals its target after a tough status card (RRG 1.8 "Damage", p. 14). The (defense) label makes the hero
 *   the defender, not a basic defense (RRG 1.8 "Defend, Defense", p. 15); the (attack) label makes the 3 damage an
 *   attack against the attacking enemy. The ability ref is `-constant` (a parse artifact of the data).
 * - **Determined Defense**: "that attack removes threat from the main scheme instead of dealing damage" is
 *   `modifyAttack({ removesThreatFrom })` on the attack you are defending: its damage step deals nothing and takes the
 *   damage it calculated (RRG 1.8 "Attack (Enemy Activation)" step 4, p. 9: ATK and boost icons, less your DEF when the
 *   defense is basic) off the main scheme as a thwart by your hero (the label; RRG 1.8 "Labeled Ability", p. 26). So a
 *   crisis icon or an engaged patrol minion leaves the threat where it is (pp. 14, 32) and the damage is still
 *   replaced, and a confused hero cancels the whole ability but its cost: the 2 resources are spent, the confused card
 *   goes, the attack deals its damage and this card stays in play (its removal is an effect, not a cost). "When you
 *   defend" is heard for a basic defense and for another "(defense)" ability alike; an ally's defense is not yours.
 *   The ability ref is `-constant` (a parse artifact of the data, as Brazen Defense's is).
 * - **Heroic Intervention, Mentorship**: "(thwart)" abilities that "remove 5 threat from among schemes in play". The
 *   label makes each scheme's share a thwart by your hero although no THW is used (RRG 1.8 "Labeled Ability", p. 26;
 *   owner decision, 2026-10-03), so an engaged patrol minion keeps the main scheme's share on it (p. 32). Surprise! is
 *   an unlabeled response: its removal is not a thwart.
 * - **Swagger**: "When you make a basic defense, you get +3 DEF" is the interrupt to your basic DEF use
 *   (`basicPowerUsing`, power `defense`) with `modifyBasicPower(3)`, as Rapid Growth (`ant` 13005) does for any power.
 * - **Resources** (War Cry, Improvisation, Bodyguard, Fortitude): `generatesFor` an event with either trait, as
 *   Solid's does; the other effects resolve with the payment (docs/phase7-wave4.md §3.30).
 * - **Thwart actions** (Heroic Intervention, Mentorship): "(thwart)" with "from among schemes in play" is
 *   `divide("threat", n, scheme)` under the `thwart` label, as Inconspicuous (`trors` 04038) is.
 * - **Group Assault / Rescue Operation**: "prevent all consequential damage each ally would take from attacking /
 *   thwarting" is a phase-long `preventAllDamage` scoped to consequential damage (docs/phase7-wave6.md §3.31), read as
 *   that damage is applied: dealt and prevented, never taken. "Each ally" is every ally in play, any player's.
 * - **Compassion**: "heal 3 damage from among characters you control" is `divide("heal", 3, …)` over your identity
 *   and your allies: 3 damage is healed in all, split as you choose, no character taking more than the damage on it
 *   (RRG 1.8 "Heal", p. 22), and all of their damage when they hold less than 3. "After you recover" hears the basic
 *   recovery once it has healed, so the 3 is divided over the damage that is left; "and draw 1 card" happens whether
 *   or not anything was healed (RRG 1.8 "'And'", p. 7).
 * - **Surprise!**: "After you thwart" is a hero response to a thwart by your identity; "from among schemes" is the same
 *   `divide`, not a thwart.
 */
export const MUT_GEN_ROLE_UPGRADES = defineAbilities({
  // Coup de Grace (Brawler 32176, Commander 32181) — Hero Interrupt: When you attack, this attack deals 3 additional
  // damage and gains overkill. Remove this card from the game and the campaign pool.
  "32176.coup-de-grace-interrupt": heroInterrupt(
    YOU_ATTACK,
    modifyAttack({ extraDamage: 3, overkill: true }),
    ...REMOVE_THIS_CARD,
  ),
  "32181.coup-de-grace-interrupt": heroInterrupt(
    YOU_ATTACK,
    modifyAttack({ extraDamage: 3, overkill: true }),
    ...REMOVE_THIS_CARD,
  ),

  // Swagger (Brawler 32177, Defender 32186) — Hero Interrupt (defense): When you make a basic defense, you get +3 DEF.
  // Ready your hero. Remove this card from the game and the campaign pool.
  "32177.swagger-interrupt": heroInterrupt(
    MAKE_A_BASIC_DEFENSE,
    { label: "defense" },
    modifyBasicPower(3),
    ready(yourIdentity),
    ...REMOVE_THIS_CARD,
  ),
  "32186.swagger-interrupt": heroInterrupt(
    MAKE_A_BASIC_DEFENSE,
    { label: "defense" },
    modifyBasicPower(3),
    ready(yourIdentity),
    ...REMOVE_THIS_CARD,
  ),

  // Brazen Defense (Brawler 32178) — Hero Interrupt (attack/defense): When an enemy attacks, spend 1 resource of any
  // type -> prevent 3 damage from this attack and deal 3 damage to that enemy. Remove this card from the game and the
  // campaign pool.
  "32178.brazen-defense-constant": heroInterrupt(
    AN_ENEMY_ATTACKS,
    { label: ["attack", "defense"], cost: spend(1) },
    modifyAttack({ preventDamage: 3 }),
    attack(3, eventSource),
    ...REMOVE_THIS_CARD,
  ),

  // Ferocious Attack (Brawler 32179) — Hero Action (attack): Spend 3 resources of any type -> deal 6 damage to an
  // enemy and ready your hero. Remove this card from the game and the campaign pool.
  "32179.ferocious-attack-action": heroAction(
    { label: "attack", cost: spend(3) },
    attackAnEnemy(6),
    ready(yourIdentity),
    ...REMOVE_THIS_CARD,
  ),

  // War Cry (Brawler 32180) — Hero Resource: Generate [wild][wild] resources for an Attack or Defense event. Gain a
  // tough status card. Remove this card from the game and the campaign pool.
  "32180.war-cry-resource": heroResource(...wildPairFor(ATTACK, DEFENSE), giveTough(yourIdentity), ...REMOVE_THIS_CARD),

  // Compassion (Commander 32182, Peacekeeper 32192) — Alter-Ego Response: After you recover, heal 3 damage from among
  // characters you control and draw 1 card. Remove this card from the game and the campaign pool.
  "32182.compassion-response": alterEgoResponse(
    YOU_RECOVER,
    divide("heal", 3, query("character", { controller: "you" })),
    draw(1),
    ...REMOVE_THIS_CARD,
  ),
  "32192.compassion-response": alterEgoResponse(
    YOU_RECOVER,
    divide("heal", 3, query("character", { controller: "you" })),
    draw(1),
    ...REMOVE_THIS_CARD,
  ),

  // Group Assault (Commander 32183) — Hero Action: Until the end of the phase, prevent all consequential damage each
  // ally would take from attacking. Remove this card from the game and the campaign pool.
  "32183.group-assault-action": heroAction(
    applyRuleUntil(preventConsequentialDamage(query("ally"), { from: "attack" }), "endOfPhase"),
    ...REMOVE_THIS_CARD,
  ),

  // Shock and Awe (Commander 32184) — Hero Action (attack): Spend 3 resources of any type -> deal 6 damage to an enemy
  // and ready each ally you control. Remove this card from the game and the campaign pool.
  "32184.shock-and-awe-action": heroAction(
    { label: "attack", cost: spend(3) },
    attackAnEnemy(6),
    ready(each(query("ally", { controller: "you" }))),
    ...REMOVE_THIS_CARD,
  ),

  // Improvisation (Commander 32185) — Hero Resource: Generate [wild][wild] resources for an Attack or Tactic event.
  // Ready an ally and heal 2 damage from it. Remove this card from the game and the campaign pool.
  "32185.improvisation-resource": heroResource(
    ...wildPairFor(ATTACK, TACTIC),
    chooseTarget("ally", query("ally")),
    ready(chosen("ally")),
    heal(2, chosen("ally")),
    ...REMOVE_THIS_CARD,
  ),

  // Surprise! (Defender 32187, Peacekeeper 32191) — Hero Response: After you thwart, remove 3 threat from among
  // schemes in play. Confuse an enemy. Remove this card from the game and the campaign pool.
  "32187.surprise-response": heroResponse(
    on.thwarts(YOUR_IDENTITY),
    divide("threat", 3, query("scheme")),
    anEnemy("enemy"),
    confuse(chosen("enemy")),
    ...REMOVE_THIS_CARD,
  ),
  "32191.surprise-response": heroResponse(
    on.thwarts(YOUR_IDENTITY),
    divide("threat", 3, query("scheme")),
    anEnemy("enemy"),
    confuse(chosen("enemy")),
    ...REMOVE_THIS_CARD,
  ),

  // Heroic Intervention (Defender 32188) — Hero Action (thwart): Spend 3 resources of any type -> remove 5 threat from
  // among schemes in play. You gain a tough status card. Remove this card from the game and the campaign pool.
  "32188.heroic-intervention-action": heroAction(
    { label: "thwart", cost: spend(3) },
    divide("threat", 5, query("scheme")),
    giveTough(yourIdentity),
    ...REMOVE_THIS_CARD,
  ),

  // Determined Defense (Defender 32189) — Hero Interrupt (defense/thwart): When you defend against an attack, spend 2
  // resources of any type -> that attack removes threat from the main scheme instead of dealing damage. Remove this
  // card from the game and the campaign pool.
  "32189.determined-defense-constant": heroInterrupt(
    YOU_DEFEND,
    { label: ["defense", "thwart"], cost: spend(2) },
    modifyAttack({ removesThreatFrom: { scheme: theMainScheme, thwart: true } }),
    ...REMOVE_THIS_CARD,
  ),

  // Bodyguard (Defender 32190) — Hero Resource: Generate [wild][wild] resources for a Defense or Thwart event. Draw 1
  // card. Remove this card from the game and the campaign pool.
  "32190.bodyguard-resource": heroResource(...wildPairFor(DEFENSE, THWART), draw(1), ...REMOVE_THIS_CARD),

  // Rescue Operation (Peacekeeper 32193) — Hero Action: Until the end of the phase, prevent all consequential damage
  // each ally would take from thwarting. Remove this card from the game and the campaign pool.
  "32193.rescue-operation-action": heroAction(
    applyRuleUntil(preventConsequentialDamage(query("ally"), { from: "thwart" }), "endOfPhase"),
    ...REMOVE_THIS_CARD,
  ),

  // Mentorship (Peacekeeper 32194) — Hero Action (thwart): Spend 3 resources of any type -> remove 5 threat from among
  // schemes in play. Ready each ally you control. Remove this card from the game and the campaign pool.
  "32194.mentorship-action": heroAction(
    { label: "thwart", cost: spend(3) },
    divide("threat", 5, query("scheme")),
    ready(each(query("ally", { controller: "you" }))),
    ...REMOVE_THIS_CARD,
  ),

  // Fortitude (Peacekeeper 32195) — Hero Resource: Generate [wild][wild] resources for a Tactic or Thwart event. Stun
  // an enemy. Remove this card from the game and the campaign pool.
  "32195.fortitude-resource": heroResource(
    ...wildPairFor(TACTIC, THWART),
    anEnemy("enemy"),
    stun(chosen("enemy")),
    ...REMOVE_THIS_CARD,
  ),
});
